export function extractPrimitiveAttributes(primitive) {
  const data = {};
  const propertyNames = primitive.getPropertyNames();
  const length = propertyNames.length;
  for (let i = 0; i < length; ++i) {
    const key = propertyNames[i];
    const value = primitive.getProperty(key);
    data[key] = value;
  }
  return data;
}