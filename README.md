## Deploy

1. First, install dependencies:
   ```bash
   npm install
   ```

2. Configuration Parameters:

   Before deploying, make sure to set the following configuration parameters:
   - Account ID
   - Certificate ARN
   - Domain Name
   - Hosted zone name
   - Hosted zone ID

3. Bootstrap:
   ```bash
   cdk bootstrap
   ```

4. Synthesize:
   ```bash
   cdk synth
   ```

5. Deploy:
   ```bash
   cdk deploy
   ```

## Useful commands

- `npm run build`: Compile TypeScript to JavaScript.
- `npm run watch`: Watch for changes and compile.
- `npm run test`: Perform Jest unit tests.
- `cdk deploy`: Deploy this stack to your default AWS account/region.
- `cdk diff`: Compare deployed stack with current state.
- `cdk synth`: Emit the synthesized CloudFormation template.
