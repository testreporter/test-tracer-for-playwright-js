import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import fs, { readFileSync } from 'fs';
import AdmZip from 'adm-zip';
import { TestTracerFeature, TestTracerOptions } from './Types';
import { TestResult as TestTracerResult } from './TestResult';

class TestTracerReporter implements Reporter {
  private options: TestTracerOptions | null = null;

  private testCount = 0;

  private testTracerBaseUrl = 'https://api.testtracer.io';

  private uploadKey = '';

  private results: TestTracerResult[] = [];

  private featureUniqueName = '';

  private featureDisplayName = '';
  private resultsDir = 'test-tracer';

  steps: [];

  constructor() {
    fs.rmSync(this.resultsDir, { recursive: true, force: true });
    fs.mkdir(this.resultsDir, (error) => {
      if (error) {
        console.error('Failed to create the Test Tracer directory');
      }
    });
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
    this.uploadKey = process.env.TEST_TRACER_UPLOAD_TOKEN || '';
  }

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

      fs.writeFileSync(
        `${this.resultsDir}/${report.testCaseRunId}.json`,
        JSON.stringify(report)
      );
    });
  }

  async onExit(): Promise<void> {
    await this.zipResults();
    await this.uploadResults();
    await this.processResults();
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

  zipResults = async (): Promise<void> => {
    const zip = new AdmZip();

    const files = fs.readdirSync(this.resultsDir);

    files.forEach((f: string) => {
      console.log({ f });
      zip.addLocalFile(`${this.resultsDir}/${f}`);
    });

    await zip.writeZip(`${this.resultsDir}/results.zip`);
  };

  processResults = async (): Promise<void> => {
    const resp = await fetch(`${this.testTracerBaseUrl}/test-data/process`, {
      method: 'POST',
      headers: {
        'x-api-key': this.uploadKey,
      },
    });

    console.log({ resp });
  };

  uploadResults = async (): Promise<void> => {
    const form = new FormData();
    const data = readFileSync(`${this.resultsDir}/results.zip`);

    const blob = new Blob([data]);
    form.set('file', blob, `${this.resultsDir}/results.zip`);

    const resp = await fetch(`${this.testTracerBaseUrl}/test-data/upload`, {
      method: 'POST',
      body: form,
      headers: {
        'x-api-key': this.uploadKey,
      },
    });

    console.log({ resp });
  };
}

export default TestTracerReporter;
