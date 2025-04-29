function exactcompareObjectKeys(obj1: Record<string, any>, obj2: Record<string, any>): boolean {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    return keys1.every(key => keys2.includes(key));
}

interface FilterParams {
    required: string[] | Record<string, any>;
    actualObj: Record<string, any>;
}

function filterRequiredFields({ required, actualObj }: FilterParams): Record<string, any> {
    if (!required || !actualObj) {
        throw new Error('Both required and actualObj parameters must be provided');
    }

    if (typeof actualObj !== 'object' || actualObj === null) {
        throw new Error('actualObj must be a valid object');
    }

    if (!Array.isArray(required) && (typeof required !== 'object' || required === null)) {
        throw new Error('required parameter must be either an array or an object');
    }

    const filteredObj: Record<string, any> = {};
    const requiredKeys = Array.isArray(required) ? required : Object.keys(required);

    if (requiredKeys.length === 0) {
        throw new Error('required parameter cannot be empty');
    }

    if (!requiredKeys.every(key => typeof key === 'string')) {
        throw new Error('All required keys must be strings');
    }

    for (const key of requiredKeys) {
        if (key in actualObj) {
            filteredObj[key] = actualObj[key];
        }
    }

    return filteredObj;
}

interface ValidateOptions {
    types?: Record<string, string>;
    validators?: Record<string, (value: any) => boolean>;
}

interface ValidateParams {
    required: string[] | Record<string, any>;
    actualObj: Record<string, any>;
    options?: ValidateOptions;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    filteredObj: Record<string, any>;
}

function validateFields({ required, actualObj, options = {} }: ValidateParams): ValidationResult {
    const filteredObj = filterRequiredFields({ required, actualObj });
    
    const validationResults: ValidationResult = {
        isValid: true,
        errors: [],
        filteredObj
    };

    const requiredKeys = Array.isArray(required) ? required : Object.keys(required);

    for (const key of requiredKeys) {
        if (!(key in filteredObj)) {
            validationResults.isValid = false;
            validationResults.errors.push(`Missing required field: ${key}`);
            continue;
        }

        if (options?.types && options.types[key]) {
            const expectedType = options.types[key];
            const actualType = typeof filteredObj[key];
            if (actualType !== expectedType) {
                validationResults.isValid = false;
                validationResults.errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${actualType}`);
            }
        }

        if (options?.validators && options.validators[key]) {
            try {
                const isValid = options.validators[key](filteredObj[key]);
                if (!isValid) {
                    validationResults.isValid = false;
                    validationResults.errors.push(`Validation failed for field: ${key}`);
                }
            } catch (error) {
                validationResults.isValid = false;
                const errorMessage = error instanceof Error ? error.message : String(error);
                validationResults.errors.push(`Validation error for ${key}: ${errorMessage}`);
            }
        }
    }

    return validationResults;
}

export {
    exactcompareObjectKeys,
    filterRequiredFields,
    validateFields
}