"use strict";
/**
 * @fileoverview Base interfaces for bytecode lifting system
 *
 * This module defines the core interfaces and types used by all bytecode lifters.
 * Provides a contract-based architecture for pluggable bytecode format support.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BytecodeUtils = exports.ValidationError = exports.VMDevirtualizationError = exports.BytecodeLifterError = exports.BYTECODE_FORMATS = void 0;
/**
 * Supported bytecode formats
 */
exports.BYTECODE_FORMATS = {
    QUICKJS: 'quickjs',
    V8_IGNITION: 'v8-ignition',
    CUSTOM_VM: 'custom-vm',
};
/**
 * Error types for bytecode lifting operations
 */
class BytecodeLifterError extends Error {
    constructor(message, format, cause) {
        super(message);
        this.format = format;
        this.cause = cause;
        this.name = 'BytecodeLifterError';
    }
}
exports.BytecodeLifterError = BytecodeLifterError;
class VMDevirtualizationError extends Error {
    constructor(message, vmType, confidence, cause) {
        super(message);
        this.vmType = vmType;
        this.confidence = confidence;
        this.cause = cause;
        this.name = 'VMDevirtualizationError';
    }
}
exports.VMDevirtualizationError = VMDevirtualizationError;
class ValidationError extends Error {
    constructor(message, report, cause) {
        super(message);
        this.report = report;
        this.cause = cause;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * Utility functions for bytecode analysis
 */
class BytecodeUtils {
    /**
     * Detect bytecode format from magic bytes
     */
    static detectFormat(bytecode) {
        // QuickJS bytecode starts with specific magic
        if (bytecode.length >= 4) {
            const magic = Array.from(bytecode.slice(0, 4));
            // QuickJS magic: 'qjs\0'
            if (magic.every((b, i) => b === [0x71, 0x6a, 0x73, 0x00][i])) {
                return exports.BYTECODE_FORMATS.QUICKJS;
            }
            // V8 Ignition has different magic patterns (version dependent)
            if (magic[0] === 0xc0 && magic[1] === 0xde) {
                return exports.BYTECODE_FORMATS.V8_IGNITION;
            }
        }
        return null;
    }
    /**
     * Read variable-length integer from bytecode
     */
    static readVarInt(data, offset) {
        let value = 0;
        let shift = 0;
        let currentOffset = offset;
        while (currentOffset < data.length) {
            const byte = data[currentOffset++];
            value |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) {
                break;
            }
            shift += 7;
            if (shift >= 32) {
                throw new Error('VarInt too long');
            }
        }
        return { value, nextOffset: currentOffset };
    }
    /**
     * Read string from bytecode with length prefix
     */
    static readString(data, offset) {
        const lengthResult = this.readVarInt(data, offset);
        const stringBytes = data.slice(lengthResult.nextOffset, lengthResult.nextOffset + lengthResult.value);
        const value = new TextDecoder('utf-8').decode(stringBytes);
        return {
            value,
            nextOffset: lengthResult.nextOffset + lengthResult.value,
        };
    }
    /**
     * Calculate instruction size for different architectures
     */
    static getInstructionSize(opcode, format) {
        switch (format) {
            case exports.BYTECODE_FORMATS.QUICKJS:
                // QuickJS instructions are variable length
                return this.getQuickJSInstructionSize(opcode);
            case exports.BYTECODE_FORMATS.V8_IGNITION:
                // V8 Ignition has mostly fixed-size instructions
                return this.getIgnitionInstructionSize(opcode);
            default:
                return 1; // Conservative default
        }
    }
    static getQuickJSInstructionSize(opcode) {
        // Simplified - would need full QuickJS opcode table
        if (opcode < 0x80)
            return 1;
        if (opcode < 0x8000)
            return 2;
        return 4;
    }
    static getIgnitionInstructionSize(opcode) {
        // V8 Ignition instruction sizes
        const bytecode = opcode & 0xff;
        if (bytecode < 0x80)
            return 1;
        if (bytecode < 0x90)
            return 2;
        if (bytecode < 0xa0)
            return 3;
        return 4;
    }
}
exports.BytecodeUtils = BytecodeUtils;
