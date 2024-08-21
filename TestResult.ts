import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import {
  TestTracerFailure,
  TestTracerFeature,
  TestTracerOptions,
  TestTracerStep,
} from './Types';

export class TestResult {
  readonly externalReference: string;

  readonly buildVersion?: string;

  readonly machineName: string;

  readonly environmentName?: string;

  readonly runAlias?: string;

  readonly branch?: string;

  readonly project?: string;

  readonly testCaseRunId: string;

  readonly metadata?: object;

  testCount: number;

  readonly buildRevision: string | undefined;

  displayName?: string;

  uniqueName?: string;

  feature: TestTracerFeature | null = null;

  startTime?: Date;

  duration?: number;

  result?: string;
  steps: TestTracerStep[];

  failure: TestTracerFailure | null = null;

  constructor(options: TestTracerOptions | null) {
    this.externalReference = options?.externalReference || uuidv4();
    this.buildVersion = options?.version;
    this.machineName = os.hostname();
    this.testCount = 0;
    this.buildRevision = options?.revision;
    this.environmentName = options?.environment;
    this.runAlias = options?.runAlias;
    this.branch = options?.branch;
    this.project = options?.projectName;
    this.testCaseRunId = uuidv4();
    this.metadata = options?.metaData
      ? (JSON.parse(options?.metaData) as object)
      : undefined;
    this.steps = [];
  }
}
