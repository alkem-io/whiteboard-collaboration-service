import { readFileSync } from 'fs';
import { join } from 'path';
import * as YAML from 'yaml';

const YAML_CONFIG_FILENAME = 'config.yml';

export default () => {
  const rawYaml = readFileSync(
    join(__dirname, '../../', YAML_CONFIG_FILENAME),
    'utf8',
  );

  const doc = YAML.parseDocument(rawYaml);
  const envConfig = process.env;

  YAML.visit(doc, {
    Scalar(key, node) {
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
  const found = key.match(/^\$\{([^}]+)\}(?::(.*))?$/);
  if (found) {
    const envVariableKey = found[1];
    const envVariableDefaultValue = found[2];

    updatedNodeValue = envConfig[envVariableKey] ?? envVariableDefaultValue;

    if (typeof updatedNodeValue === 'string') {
      const normalizedValue = updatedNodeValue.toLowerCase();
      if (normalizedValue === 'true') {
        return true;
      }
      if (normalizedValue === 'false') {
        return false;
      }
      if (updatedNodeValue.trim() !== '') {
        const numericValue = Number(updatedNodeValue);
        if (!Number.isNaN(numericValue)) {
          return numericValue;
        }
      }
    }
  }

  return updatedNodeValue;
}
