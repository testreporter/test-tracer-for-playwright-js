import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  TestStep,
  FullResult,
} from '@playwright/test/reporter';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import {
  TestTracerFeature,
  TestTracerOptions,
  TestResult as TestTracerResult,
} from './TestResult';

class TestTracerReporter implements Reporter {
  // private results: TestTracerResult[];
  private options: TestTracerOptions | null = null;

  private testCount = 0;

  private results: TestTracerResult[] = [];

  private featureUniqueName = '';

  private featureDisplayName = '';

  private feature: TestTracerFeature | null = null;

  private resultsDir = 'test-tracer';

  steps: [];

  constructor() {
    // this.result = new TestTracerResult();

    fs.rmSync(this.resultsDir, { recursive: true, force: true });
    fs.mkdir(this.resultsDir, (error) => {
      if (error) {
        console.error('Failed to create the Test Tracer directory');
      }
    });
    // this.result: ITestResult;
    this.steps = [];
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.validateParams(
      config.reporter.find((x) =>
        x[0].includes('test-tracer-reporter.ts')
      )?.[1] || {}
    );

    this.testCount = suite.allTests().length;
  }

  validateParams(options: TestTracerOptions) {
    this.options = options;

    this.options.branch = process.env.TEST_TRACER_BRANCH;
    this.options.environment = process.env.TEST_TRACER_ENVIRONMENT;
    this.options.noUpload = process.env.TEST_TRACER_NO_UPLOAD === 'true';
    this.options.revision = process.env.TEST_TRACER_REVISION;
    this.options.version = process.env.TEST_TRACER_VERSION;
    this.options.runAlias = process.env.TEST_TRACER_RUN_ALIAS;
    this.options.projectName = process.env.TEST_TRACER_PROJECT_NAME;
  }

  // onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
  //   this.steps.push({
  //     duration: step.duration,
  //     status: step.error ? "Failed" : "Passed",
  //     name: step.title,
  //   });
  // }

  onTestEnd(test: TestCase, result: TestResult) {
    test.results.forEach((res) => {
      if (
        this.results.findIndex(
          (x) => x.uniqueName === test.id && x.startTime === res.startTime
        ) > -1
      )
        return;

      const report = new TestTracerResult(this.options);

      res.steps.forEach((step) => {
        report.steps.push({
          name: step.title,
          status: step.error ? 'failed' : 'passed',
          duration: step.duration,
        });
      });

      report.testCount = this.testCount;
      report.displayName = test.title;
      report.uniqueName = test.id;
      report.feature = this.calculateFeatureName(test);
      report.startTime = res.startTime;
      report.duration = res.duration;

      switch (res.status) {
        case 'timedOut':
          report.result = 'failed';
          break;
        default:
          report.result = res.status;
          break;
      }

      this.results.push(report);

      if (res.error) {
        report.failure = {
          reason: res.error.message || '',
          trace: res.error.stack || '',
        };
      }

      fs.writeFile(
        `${this.resultsDir}/${report.testCaseRunId}.json`,
        JSON.stringify(report),
        (err) => {
          if (err) console.error({ err });
        }
      );
    });
  }

  onEnd(
    result: FullResult
  ): Promise<{ status?: FullResult['status'] } | undefined | void> | void {
    this.zipResults();
    this.uploadResults();
  }

  findName = (suite: Suite) => {
    this.featureUniqueName = suite.title + this.featureUniqueName;

    if (suite.location?.file.endsWith(suite.title)) {
      return;
    }

    this.featureDisplayName = `${suite.title} > ${this.featureDisplayName}`;

    if (suite.parent) this.findName(suite.parent);
  };

  calculateFeatureName(test: TestCase): TestTracerFeature {
    this.featureUniqueName = '';
    this.featureDisplayName = '';
    this.findName(test.parent);

    return {
      displayName: this.featureDisplayName.slice(0, -3),
      uniqueName: this.featureUniqueName,
    };
  }

  zipResults = (): void => {
    const zip = new AdmZip();

    fs.readdir(this.resultsDir, (err, files) => {
      console.log({ err });
      files.forEach((file) => {
        zip.addLocalFile(file);
      });
    });

    zip.writeZip(`${this.resultsDir}/results.zip`);
  };

  uploadResults = (): void => {
    const upload = (file: string) => {
      console.log('Fetching...');
      console.log(file);
      fetch('http://localhost:5139/test-data/upload', {
        method: 'POST',
        headers: {
          'a-api-key': 'key-here',
        },
      })
        .then((r) => console.error({ r }))
        .then((success) => {
          console.error({ success });
        })
        .catch((error) => {
          console.error({ error });
        });
    };

    upload(`${this.resultsDir}/results.zip`);
  };
}

export default TestTracerReporter;
