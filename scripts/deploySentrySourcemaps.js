const util = require('util');
const environment = require('./environments/environment.json');

const execAsync = util.promisify(require('child_process').exec);

(async (sentryToken) => {
  try {
    if (environment && environment.branch) {
      console.log(`Uploading sourcemaps for ${environment.branch}...`);
      await execAsync(`SENTRY_TOKEN=${sentryToken} RELEASE=${environment.branch} npm run sentry-sourcemaps-upload`);
      console.log('Sourcemaps uploaded.');
      process.exit(0);
    } else {
      console.error('Branch name missing.');
      process.exit(1);
    }
  } catch (e) {
    console.error(`Failed with error: "${e.message}".`);
    process.exit(1);
  }
})(process.argv.slice(2)[0]);
