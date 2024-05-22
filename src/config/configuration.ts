import { readFileSync } from 'fs';
import { join } from 'path';
// import YAML from 'yaml';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const YAML = require('yaml'); // todo: WHY??

const YAML_CONFIG_FILENAME = 'config.yml';

export default () => {
  const rawYaml = readFileSync(
    join(__dirname, '../../', YAML_CONFIG_FILENAME),
    'utf8',
  );

  const doc = YAML.parseDocument(rawYaml);
  const envConfig = process.env;

  YAML.visit(doc, {
    Scalar(key: any, node: { type: string; value: any }) {
      if (node.type === 'PLAIN') {
        node.value = buildYamlNodeValue(node.value, envConfig);
      }
    },
  });

  return doc.toJSON() as Record<string, any>;
};

function buildYamlNodeValue(nodeValue: any, envConfig: any) {
  let updatedNodeValue = nodeValue;
  const key = `${nodeValue}`;
  const regex = '\\${(.*)}:?(.*)';
  const found = key.match(regex);
  if (found) {
    const envVariableKey = found[1];
    const envVariableDefaultValue = found[2];

    updatedNodeValue = envConfig[envVariableKey] ?? envVariableDefaultValue;

    if (updatedNodeValue.toLowerCase() === 'true') return true;
    if (updatedNodeValue.toLowerCase() === 'false') return false;
  }

  return updatedNodeValue;
}
