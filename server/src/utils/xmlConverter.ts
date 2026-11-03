import { XMLBuilder } from 'fast-xml-parser';

export function convertToXML(
  rows: Record<string, unknown>[],
  rootName: string,
  itemName: string
): string {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false
  });

  return builder.build({
    [rootName]: {
      [itemName]: rows
    }
  });
}