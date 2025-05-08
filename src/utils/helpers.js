export const getEnumName = (enumObj, value) => {
    if (value === undefined || value === null || !enumObj) return 'N/A';
    for (const key in enumObj) {
        if (Object.prototype.hasOwnProperty.call(enumObj, key) && enumObj[key] === value) {
            return key;
        }
    }
    // Handle cases where value might already be the string representation (e.g., from API)
    if (typeof value === 'string' && Object.values(enumObj).includes(value)) {
        const key = Object.keys(enumObj).find(k => enumObj[k] === value);
        if (key) return key;
    }
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(enumObj, value)) return value;

    return `UNKNOWN (${value})`;
};