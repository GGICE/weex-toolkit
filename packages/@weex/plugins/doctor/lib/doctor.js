"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const android_workflow_1 = require("./android/android-workflow");
const ios_workflow_1 = require("./ios/ios-workflow");
class Doctor {
    constructor() {
        this.validators = [];
        this.getValidators();
    }
    getValidators() {
        if (android_workflow_1.androidWorkflow.appliesToHostPlatform) {
            this.validators.push(android_workflow_1.androidValidator);
        }
        if (ios_workflow_1.iosWorkflow.appliesToHostPlatform) {
            this.validators.push(ios_workflow_1.iosValidator);
        }
    }
    startValidatorTasks() {
        const tasks = [];
        for (let validator of this.validators) {
            tasks.push(new ValidatorTask(validator, validator.validate()));
        }
        return tasks;
    }
    /**
     * diagnose
     */
    diagnose() {
        const taskList = this.startValidatorTasks();
        for (let validatorTask of taskList) {
            const validator = validatorTask.validator;
            const results = [];
            let result;
            results.push(validatorTask.result);
            result = this.mergeValidationResults(results);
            console.log(`${result.leadingBox} ${validator.title} is`);
            for (let message of result.messages) {
                const text = message.message.replace('\n', '\n      ');
                if (message.isError) {
                    console.log(`    ✗  ${text}`);
                }
                else if (message.isWaring) {
                    console.log(`    !  ${text}`);
                }
                else {
                    console.log(`    •  ${text}`);
                }
            }
        }
    }
    mergeValidationResults(results) {
        let mergedType = results[0].type;
        const mergedMessages = [];
        for (let result of results) {
            switch (result.type) {
                case 2 /* installed */:
                    if (mergedType === 0 /* missing */) {
                        mergedType = 1 /* partial */;
                    }
                    break;
                case 1 /* partial */:
                    mergedType = 1 /* partial */;
                    break;
                case 0 /* missing */:
                    if (mergedType === 2 /* installed */) {
                        mergedType = 1 /* partial */;
                    }
                    break;
                default:
                    break;
            }
            mergedMessages.push(...result.messages);
        }
        return new ValidationResult(mergedType, mergedMessages, results[0].statusInfo);
    }
}
exports.Doctor = Doctor;
class ValidationResult {
    /// [ValidationResult.type] should only equal [ValidationResult.installed]
    /// if no [messages] are hints or errors.
    constructor(type, messages, statusInfo) {
        this.type = type;
        this.messages = messages;
        this.statusInfo = statusInfo;
        this.type = type;
        this.messages = messages;
    }
    get leadingBox() {
        switch (this.type) {
            case 0 /* missing */:
                return '[✗]';
            case 2 /* installed */:
                return '[✓]';
            case 1 /* partial */:
                return '[!]';
        }
        return null;
    }
}
exports.ValidationResult = ValidationResult;
class ValidatorTask {
    constructor(validator, result) {
        this.validator = validator;
        this.result = result;
        this.validator = validator;
        this.result = result;
    }
}
// A series of tools and required install steps for a target platform (iOS or Android).
class Workflow {
}
exports.Workflow = Workflow;
class DoctorValidator {
}
exports.DoctorValidator = DoctorValidator;
class ValidationMessage {
    constructor(message, isError = false, isWaring = false) {
        this.message = message;
        this.isError = isError;
        this.isWaring = isWaring;
        this.message = message;
        this.isError = isError;
        this.isWaring = isWaring;
    }
}
exports.ValidationMessage = ValidationMessage;
//# sourceMappingURL=doctor.js.map