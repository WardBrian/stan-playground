import { SamplingOpts } from "@SpCore/Project/ProjectDataModel";
import { unreachable } from "@SpUtil/unreachable";

import type { SamplerParams } from "tinystan";

import {
  Replies,
  Requests,
  StanModelReplyMessage,
  StanModelRequestMessage,
} from "./StanModelWorker";
import { type StanRunAction } from "./useStanSampler";
import StanWorkerUrl from "./StanModelWorker?worker&url";
import StanModel from "tinystan";

export type StanSamplerStatus =
  | ""
  | "loading"
  | "loaded"
  | "sampling"
  | "completed"
  | "failed";

type StanSamplerAndCleanup = {
  sampler: StanSampler;
  cleanup: () => void;
};

class StanSampler {
  #stanWorker: Worker | undefined;
  #stanModel: StanModel | undefined;
  #samplingStartTimeSec: number = 0;

  private constructor(
    private compiledUrl: string,
    private update: (action: StanRunAction) => void,
  ) {
    this._initialize();
  }

  static __unsafe_create(
    compiledUrl: string,
    update: (action: StanRunAction) => void,
  ): StanSamplerAndCleanup {
    const sampler = new StanSampler(compiledUrl, update);
    const cleanup = () => {
      console.log("terminating model worker");
      sampler.#stanWorker && sampler.#stanWorker.terminate();
      sampler.#stanWorker = undefined;
    };
    return { sampler, cleanup };
  }

  _initialize() {
    this.update({ type: "clear" });

    this.update({ type: "statusUpdate", status: "loading" });

    import(/* @vite-ignore */ this.compiledUrl)
      .then((js) => StanModel.load(js.default, console.log))
      .then((m) => {
        this.#stanModel = m;
        console.log(
          "Web Worker loaded Stan model built from version " + m.stanVersion(),
        );
      });
    this.update({ type: "statusUpdate", status: "loaded" });

    // this.#stanWorker = new Worker(StanWorkerUrl, {
    //   name: "tinystan worker",
    //   type: "module",
    // });

    // this.#stanWorker.onmessage = (e: MessageEvent<StanModelReplyMessage>) => {
    //   switch (e.data.purpose) {
    //     case Replies.Progress: {
    //       this.update({ type: "progressUpdate", progress: e.data.report });
    //       break;
    //     }
    //     case Replies.ModelLoaded: {
    //       this.update({ type: "statusUpdate", status: "loaded" });
    //       break;
    //     }
    //     case Replies.StanReturn: {
    //       if (e.data.error !== null) {
    //         this.update({
    //           type: "statusUpdate",
    //           status: "failed",
    //           errorMessage: e.data.error,
    //         });
    //       } else {
    //         this.update({
    //           type: "samplerReturn",
    //           draws: e.data.draws,
    //           paramNames: e.data.paramNames,
    //           computeTimeSec: Date.now() / 1000 - this.#samplingStartTimeSec,
    //           consoleText: e.data.consoleText,
    //         });
    //       }
    //       break;
    //     }
    //     default:
    //       unreachable(e.data);
    //   }
    // };
    // this.update({ type: "statusUpdate", status: "loading" });
    // this.postMessage({ purpose: Requests.Load, url: this.compiledUrl });
  }

  sample(data: any, samplingOpts: SamplingOpts) {
    const refresh = calculateReasonableRefreshRate(samplingOpts);
    const sampleConfig: Partial<SamplerParams> = {
      ...samplingOpts,
      data,
      seed: samplingOpts.seed !== undefined ? samplingOpts.seed : null,
      refresh,
      num_threads: samplingOpts.num_chains,
    };
    if (!this.#stanModel) throw new Error("model worker is undefined");

    this.update({ type: "startSampling", samplingOpts, data });

    this.#samplingStartTimeSec = Date.now() / 1000;

    const { paramNames, draws } = this.#stanModel.sample(sampleConfig);

    this.update({
      type: "samplerReturn",
      draws: draws,
      paramNames: paramNames,
      computeTimeSec: Date.now() / 1000 - this.#samplingStartTimeSec,
      consoleText: "todo",
    });
  }

  private postMessage(message: StanModelRequestMessage) {
    if (!this.#stanWorker) throw new Error("model worker is undefined");
    this.#stanWorker.postMessage(message);
  }

  cancel() {
    this.#stanWorker?.terminate();
    this._initialize();
  }
}

const calculateReasonableRefreshRate = (samplingOpts: SamplingOpts) => {
  const totalSamples =
    (samplingOpts.num_samples + samplingOpts.num_warmup) *
    samplingOpts.num_chains;

  const onePercent = Math.floor(totalSamples / 100);

  const nearestMultipleOfTen = Math.round(onePercent / 10) * 10;

  return Math.max(10, nearestMultipleOfTen);
};

export default StanSampler;
