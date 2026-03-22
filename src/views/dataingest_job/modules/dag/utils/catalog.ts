export type SelectOption = { label: string; value: string };

export function mapCatalogOptions(data: Api.Metadata.EntityInstance[]): SelectOption[] {
  return data.map(item => ({ label: item.displayName, value: item.uuid }));
}

function parseCatalogColumnProperties(properties?: string | null) {
  if (!properties) {
    return {};
  }
  try {
    return JSON.parse(properties) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function mapCatalogColumns(data: Api.Metadata.EntityInstance[]): Api.Dataingest.IngestFieldMeta[] {
  return data.map(item => {
    const properties = parseCatalogColumnProperties(item.properties);
    return {
      fieldName: item.displayName,
      normalizedFieldName: item.displayName.toLowerCase(),
      dataType: String(properties.dataType ?? properties.type ?? ''),
      nullable: typeof properties.nullable === 'boolean' ? properties.nullable : undefined,
      primaryKey: typeof properties.primaryKey === 'boolean' ? properties.primaryKey : undefined,
      comment: item.description,
      sortNum: typeof properties.ordinalPosition === 'number' ? properties.ordinalPosition : undefined
    };
  });
}

export function findOptionLabel(options: SelectOption[], value: string) {
  return String(options.find(item => String(item.value) === value)?.label ?? '');
}
