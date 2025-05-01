export type StancErrors = {
  errors?: string[];
  warnings?: string[];
};

type StancReturn = { result?: string } & StancErrors;

export type StancFunction = (
  name: string,
  code: string,
  args: string[],
) => StancReturn;

export type StancReplyMessage = { fatal: string } | StancReturn;

export enum StancWorkerRequests {
  FormatStanCode = "format",
  CheckSyntax = "check",
  LoadNewStancURL = "loadStancURL",
}

export type StancRequestMessage =
  | {
      purpose:
        | StancWorkerRequests.FormatStanCode
        | StancWorkerRequests.CheckSyntax;
      name: string;
      code: string;
      pedantic: boolean;
    }
  | {
      purpose: StancWorkerRequests.LoadNewStancURL;
      stancURL: string;
    };
