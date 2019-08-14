/**
 * A record for a single custom serializer in a list of customs.
 * The name should be unique to map the serializer with a corresponding deserializer.
 */
export type CustomSerializerRecord = {
    name: string,
    value: any,
    serializer: () => string
};

/**
 * A record for a single custom deserializer in a list of customs.
 * The name should reflect the name used during serialization.
 */
export type CustomDeserializerRecord = {
    name: string,
    deserializer: (string) => any
};

/**
 * A read-only list of custom serializers.
 */
export type CustomSerializerList = ReadonlyArray<CustomSerializerRecord>;

/**
 * A read-only list of custom deserializers.
 */
export type CustomDeserializerList = ReadonlyArray<CustomDeserializerRecord>;

/**
 * A default collection of customs to give special treatment.
 */
export const defaultCustoms: CustomSerializerList = [];

/**
 * Returns a custom serializer for a particular value if it is contained in the customList.
 * @param value The value to be checked for a custom serializer.
 * @param customList An optional list of CustomRecords to search through.
 * @returns A custom serializer for `value`; otherwise, `undefined`.
 */
export function retrieveCustomSerializer(value: any, customList?: CustomSerializerList): CustomSerializerRecord | undefined {
    if (!customList) return undefined
    // Check if value requires a custom serializer
    for (let custom of customList) {
        if (custom.value === value) {
            return custom;
        }
    }
    return undefined;
}

/**
 * Returns a custom deserializer for a particular 'name' if it is contained in the customList.
 * @param name The name to find a custom deserializer.
 * @param customList An optional list of CustomDeserializerRecord to search through.
 * @returns A custom deserializer for `name`-values; otherwise, `undefined`.
 */
export function retrieveCustomDeserializer(name: any, customList?: CustomDeserializerList): (string) => any | undefined {
    if (!customList) return undefined
    // Check if value requires a custom deserializer
    for (let custom of customList) {
        if (custom.name === name) {
            return custom.deserializer;
        }
    }
    return undefined;
}