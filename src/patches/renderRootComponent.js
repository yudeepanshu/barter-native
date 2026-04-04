// Patched copy of expo-router/build/renderRootComponent.js
// Only change: added .catch(() => {}) to the _internal_preventAutoHideAsync call
// to prevent "ExpoKeepAwake.activate has been rejected" unhandled rejection on Android
// when the Activity is torn down during hot-reload.
//
// All bare/relative imports have been made absolute so this file can live anywhere
// in the project tree. Update this file when upgrading expo-router.
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderRootComponent = renderRootComponent;
const expo_1 = require("expo");
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// Use absolute package path so this file resolves correctly from any location.
const SplashScreen = __importStar(require("expo-router/build/utils/splash"));
function isBaseObject(obj) {
    if (Object.prototype.toString.call(obj) !== '[object Object]') {
        return false;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto === null) {
        return true;
    }
    return proto === Object.prototype;
}
function isErrorShaped(error) {
    return (error &&
        typeof error === 'object' &&
        typeof error.name === 'string' &&
        typeof error.message === 'string');
}
function convertError(error) {
    if (isErrorShaped(error)) {
        return error;
    }
    if (process.env.NODE_ENV === 'development') {
        if (error == null) {
            return new Error('A null/undefined error was thrown.');
        }
    }
    if (isBaseObject(error)) {
        return new Error(JSON.stringify(error));
    }
    return new Error(String(error));
}
function renderRootComponent(Component) {
    try {
        if (process.env.NODE_ENV !== 'production') {
            require('@expo/log-box/lib').setupLogBox();
        }
        // PATCHED: added .catch(() => {}) to prevent unhandled "ExpoKeepAwake.activate"
        // rejection on Android when the Activity is no longer available during hot-reload.
        setTimeout(() => {
            SplashScreen._internal_preventAutoHideAsync?.().catch(() => {});
        });
        React.startTransition(() => {
            (0, expo_1.registerRootComponent)(Component);
        });
    }
    catch (e) {
        SplashScreen.hideAsync();
        const error = convertError(e);
        (0, expo_1.registerRootComponent)(() => React.createElement(react_native_1.View, null));
        if (process.env.EXPO_OS === 'web') {
            console.error(error);
            console.error(`A runtime error has occurred while rendering the root component.`);
        }
        setTimeout(() => {
            throw error;
        });
    }
}
