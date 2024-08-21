export type TestTracerFeature = {
  displayName: string;
  uniqueName: string;
};

export type TestTracerStep = {
  name: string;
  status: string;
  duration: number;
};

export type TestTracerFailure = {
  reason: string;
  trace: string;
};

export type TestTracerOptions = {
  projectName?: string;
  externalReference?: string;
  environment?: string;
  revision?: string;
  version?: string;
  branch?: string;
  noUpload?: boolean;
  runAlias?: string;
  metaData: string;
};
