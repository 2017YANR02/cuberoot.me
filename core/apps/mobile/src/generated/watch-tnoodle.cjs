"use strict";
(function(module) {
    if (typeof define === 'function' && define.amd) {
        define(['exports'], function(exports)  {
            module(exports);
        });
    } else if (typeof exports === 'object' && exports !== null && typeof exports.nodeName !== 'string') {
        module(exports);
    } else {
        module(typeof self !== 'undefined' ? self : this);
}
}(function($rt_exports) {
let $rt_seed = 2463534242,
$rt_nextId = () => {
    let x = $rt_seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    $rt_seed = x;
    return x;
},
$rt_wrapFunction0 = f => function() {
    return f(this);
},
$rt_wrapFunction1 = f => function(p1) {
    return f(this, p1);
},
$rt_wrapFunction2 = f => function(p1, p2) {
    return f(this, p1, p2);
},
$rt_wrapFunction3 = f => function(p1, p2, p3) {
    return f(this, p1, p2, p3);
},
$rt_wrapFunction4 = f => function(p1, p2, p3, p4) {
    return f(this, p1, p2, p3, p4);
},
$rt_mainStarter = f => (args, callback) => {
    if (!args) {
        args = [];
    }
    let javaArgs = $rt_createArray($rt_objcls(), args.length);
    for (let i = 0;i < args.length;++i) {
        javaArgs.data[i] = $rt_str(args[i]);
    }
    $rt_startThread(() => {
        f.call(null, javaArgs);
    }, callback);
},
$rt_eraseClinit = target => target.$clinit = () => {
},
$dbg_class = obj => {
    let cls = obj.constructor;
    let arrayDegree = 0;
    while (cls[$rt_meta] && cls[$rt_meta].item) {
        ++arrayDegree;
        cls = cls[$rt_meta].item;
    }
    let clsName = "";
    if (cls[$rt_meta].primitiveKind !== 0) {
        clsName = cls[$rt_meta].name;
    } else {
        clsName = cls[$rt_meta] ? cls[$rt_meta].name || "a/" + cls.name : "@" + cls.name;
    }
    while (arrayDegree-- > 0) {
        clsName += "[]";
    }
    return clsName;
},
$rt_classWithoutFields = superclass => {
    if (superclass === 0) {
        return function() {
        };
    }
    if (superclass === void 0) {
        superclass = $rt_objcls();
    }
    return function() {
        superclass.call(this);
    };
},
$rt_meta = Symbol("teavm_meta"),
$rt_cls = cls => {
    if (cls[$rt_meta].classObject === null) {
        cls[$rt_meta].classObject = jl_Class_createClass(cls);
    }
    return cls[$rt_meta].classObject;
},
$rt_objcls = () => jl_Object,
$rt_getThread = () => {
    {
        return jl_Thread_currentThread();
    }
},
$rt_setThread = t => {
    {
        return jl_Thread_setCurrentThread(t);
    }
},
$rt_newClassMetadata = source => {
    return Object.assign({ name : null, binaryName : null, parent : null, superinterfaces : [], modifiers : 0, primitiveKind : 0, itemType : null, arrayType : null, enclosingClass : null, declaringClass : null, simpleName : null, clinit : () => {
    }, constructor : null, enumConstants : () => null, resolvedEnumConstants : null, reflection : null, classObject : null, assignableCache : null, valueToObject : o => o, objectToValue : o => o }, source || {  });
},
$rt_createPrimitiveCls = (name, binaryName, kind, config) => {
    let cls = () => {
    };
    let meta = $rt_newClassMetadata({ name : name, binaryName : binaryName, modifiers : 1 | 1 << 4, primitiveKind : kind });
    cls[$rt_meta] = meta;
    if (typeof config === 'function') {
        config(meta);
    }
    return cls;
},
$rt_booleancls = $rt_createPrimitiveCls("boolean", "Z", 1, meta => {
}),
$rt_bytecls = $rt_createPrimitiveCls("byte", "B", 2, meta => {
}),
$rt_shortcls = $rt_createPrimitiveCls("short", "S", 3, meta => {
}),
$rt_charcls = $rt_createPrimitiveCls("char", "C", 4, meta => {
}),
$rt_intcls = $rt_createPrimitiveCls("int", "I", 5, meta => {
    {
        meta.valueToObject = o => jl_Integer_valueOf(o);
    }
    {
        meta.objectToValue = o => jl_Integer_intValue(o);
    }
}),
$rt_longcls = $rt_createPrimitiveCls("long", "J", 6, meta => {
}),
$rt_floatcls = $rt_createPrimitiveCls("float", "F", 7, meta => {
}),
$rt_doublecls = $rt_createPrimitiveCls("double", "D", 8, meta => {
}),
$rt_voidcls = $rt_createPrimitiveCls("void", "V", 9),
$rt_numberConversionBuffer = new ArrayBuffer(16),
$rt_numberConversionFloatArray = new Float32Array($rt_numberConversionBuffer),
$rt_numberConversionDoubleArray = new Float64Array($rt_numberConversionBuffer),
$rt_numberConversionIntArray = new Int32Array($rt_numberConversionBuffer),
$rt_numberConversionLongArray = new BigInt64Array($rt_numberConversionBuffer),
$rt_doubleToRawLongBits = n => {
    $rt_numberConversionDoubleArray[0] = n;
    return $rt_numberConversionLongArray[0];
},
$rt_floatToRawIntBits = n => {
    $rt_numberConversionFloatArray[0] = n;
    return $rt_numberConversionIntArray[0];
},
$rt_compare = (a, b) => a === b ? 0 : a < b ?  -1 : 1,
$rt_imul = Math.imul || function(a, b) {
    let ah = a >>> 16 & 0xFFFF;
    let al = a & 0xFFFF;
    let bh = b >>> 16 & 0xFFFF;
    let bl = b & 0xFFFF;
    return al * bl + (ah * bl + al * bh << 16 >>> 0) | 0;
},
$rt_udiv = (a, b) => (a >>> 0) / (b >>> 0) >>> 0,
$rt_umod = (a, b) => (a >>> 0) % (b >>> 0) >>> 0,
$rt_ucmp = (a, b) => {
    a >>>= 0;
    b >>>= 0;
    return a < b ?  -1 : a > b ? 1 : 0;
},
Long_ZERO = BigInt(0),
Long_create = (lo, hi) => BigInt.asIntN(64, BigInt.asUintN(64, BigInt(lo)) | BigInt.asUintN(64, BigInt(hi) << BigInt(32))),
Long_fromInt = val => BigInt.asIntN(64, BigInt(val | 0)),
Long_fromNumber = val => BigInt.asIntN(64, BigInt(val >= 0 ? Math.floor(val) : Math.ceil(val))),
Long_hi = val => Number(BigInt.asIntN(64, val >> BigInt(32))) | 0,
Long_lo = val => Number(BigInt.asIntN(32, val)) | 0,
Long_eq = (a, b) => a === b,
Long_ge = (a, b) => a >= b,
Long_lt = (a, b) => a < b,
Long_add = (a, b) => BigInt.asIntN(64, a + b),
Long_sub = (a, b) => BigInt.asIntN(64, a - b);
let Long_mul = (a, b) => BigInt.asIntN(64, a * b),
Long_div = (a, b) => BigInt.asIntN(64, a / b),
Long_and = (a, b) => BigInt.asIntN(64, a & b),
Long_or = (a, b) => BigInt.asIntN(64, a | b),
Long_xor = (a, b) => BigInt.asIntN(64, a ^ b),
Long_shl = (a, b) => BigInt.asIntN(64, a << BigInt(b & 63)),
Long_shr = (a, b) => BigInt.asIntN(64, a >> BigInt(b & 63)),
$rt_createArray = (cls, sz) => {
    let data = new Array(sz);
    data.fill(null);
    return new ($rt_arraycls(cls))(data);
},
$rt_wrapArray = (cls, data) => new ($rt_arraycls(cls))(data),
$rt_createUnfilledArray = (cls, sz) => new ($rt_arraycls(cls))(new Array(sz)),
$rt_createLongArray = sz => new $rt_longArrayCls(new BigInt64Array(sz)),
$rt_createCharArray = sz => new $rt_charArrayCls(new Uint16Array(sz)),
$rt_createCharArrayFromData = data => {
    let buffer = new Uint16Array(data.length);
    buffer.set(data);
    return new $rt_charArrayCls(buffer);
},
$rt_createByteArray = sz => new $rt_byteArrayCls(new Int8Array(sz)),
$rt_createByteArrayFromData = data => {
    let buffer = new Int8Array(data.length);
    buffer.set(data);
    return new $rt_byteArrayCls(buffer);
},
$rt_createIntArray = sz => new $rt_intArrayCls(new Int32Array(sz)),
$rt_createIntArrayFromData = data => {
    let buffer = new Int32Array(data.length);
    buffer.set(data);
    return new $rt_intArrayCls(buffer);
},
$rt_createBooleanArray = sz => new $rt_booleanArrayCls(new Int8Array(sz)),
$rt_arraycls = cls => {
    let result = cls[$rt_meta].arrayType;
    if (result === null) {
        function JavaArray(data) {
            ($rt_objcls()).call(this);
            this.data = data;
        }
        JavaArray.prototype = Object.create(($rt_objcls()).prototype);
        JavaArray.prototype.type = cls;
        JavaArray.prototype.constructor = JavaArray;
        JavaArray.prototype.toString = function() {
            let str = "[";
            for (let i = 0;i < this.data.length;++i) {
                if (i > 0) {
                    str += ", ";
                }
                str += this.data[i].toString();
            }
            str += "]";
            return str;
        };
        JavaArray.prototype.$clone0 = function() {
            let dataCopy;
            if ('slice' in this.data) {
                dataCopy = this.data.slice();
            } else {
                dataCopy = new this.data.constructor(this.data.length);
                for (let i = 0;i < dataCopy.length;++i) {
                    dataCopy[i] = this.data[i];
                }
            }
            return new ($rt_arraycls(this.type))(dataCopy);
        };
        let name = "[" + cls[$rt_meta].binaryName;
        JavaArray[$rt_meta] = $rt_newClassMetadata({ name : name, binaryName : name, parent : $rt_objcls(), itemType : cls });
        result = JavaArray;
        cls[$rt_meta].arrayType = JavaArray;
    }
    return result;
},
$rt_createMultiArray = (cls, dimensions) => {
    let first = 0;
    for (let i = dimensions.length - 1;i >= 0;i = i - 1 | 0) {
        if (dimensions[i] === 0) {
            first = i;
            break;
        }
    }
    if (first > 0) {
        for (let i = 0;i < first;i = i + 1 | 0) {
            cls = $rt_arraycls(cls);
        }
        if (first === dimensions.length - 1) {
            return $rt_createArray(cls, dimensions[first]);
        }
    }
    let arrays = new Array($rt_primitiveArrayCount(dimensions, first));
    let firstDim = dimensions[first] | 0;
    for (let i = 0;i < arrays.length;i = i + 1 | 0) {
        arrays[i] = $rt_createArray(cls, firstDim);
    }
    return $rt_createMultiArrayImpl(cls, arrays, dimensions, first, 0);
},
$rt_createCharMultiArray = dimensions => {
    let arrays = new Array($rt_primitiveArrayCount(dimensions, 0));
    if (arrays.length === 0) {
        return $rt_createMultiArray($rt_charcls, dimensions);
    }
    let firstDim = dimensions[0] | 0;
    for (let i = 0;i < arrays.length;i = i + 1 | 0) {
        arrays[i] = $rt_createCharArray(firstDim);
    }
    return $rt_createMultiArrayImpl($rt_charcls, arrays, dimensions, 0);
},
$rt_createIntMultiArray = dimensions => {
    let arrays = new Array($rt_primitiveArrayCount(dimensions, 0));
    if (arrays.length === 0) {
        return $rt_createMultiArray($rt_intcls, dimensions);
    }
    let firstDim = dimensions[0] | 0;
    for (let i = 0;i < arrays.length;i = i + 1 | 0) {
        arrays[i] = $rt_createIntArray(firstDim);
    }
    return $rt_createMultiArrayImpl($rt_intcls, arrays, dimensions, 0);
},
$rt_primitiveArrayCount = (dimensions, start) => {
    let val = dimensions[start + 1] | 0;
    for (let i = start + 2;i < dimensions.length;i = i + 1 | 0) {
        val = val * (dimensions[i] | 0) | 0;
        if (val === 0) {
            break;
        }
    }
    return val;
},
$rt_createMultiArrayImpl = (cls, arrays, dimensions, start) => {
    let limit = arrays.length;
    for (let i = start + 1 | 0;i < dimensions.length;i = i + 1 | 0) {
        cls = $rt_arraycls(cls);
        let dim = dimensions[i];
        let index = 0;
        let packedIndex = 0;
        while (index < limit) {
            let arr = $rt_createUnfilledArray(cls, dim);
            for (let j = 0;j < dim;j = j + 1 | 0) {
                arr.data[j] = arrays[index];
                index = index + 1 | 0;
            }
            arrays[packedIndex] = arr;
            packedIndex = packedIndex + 1 | 0;
        }
        limit = packedIndex;
    }
    return arrays[0];
};
function $rt_arrayLength(array) {
    return array.data.length;
}
let $rt_stringPool_instance,
$rt_stringPool = strings => {
    $rt_stringClassInit();
    $rt_stringPool_instance = new Array(strings.length);
    for (let i = 0;i < strings.length;++i) {
        $rt_stringPool_instance[i] = $rt_intern($rt_str(strings[i]));
    }
},
$rt_s = index => $rt_stringPool_instance[index],
$rt_charArrayToString = (array, offset, count) => {
    let result = "";
    let limit = offset + count;
    for (let i = offset;i < limit;i = i + 1024 | 0) {
        let next = Math.min(limit, i + 1024 | 0);
        result += String.fromCharCode.apply(null, array.subarray(i, next));
    }
    return result;
},
$rt_str = str => str === null ? null : jl_String__init_3(str),
$rt_ustr = str => str === null ? null : str.$nativeString,
$rt_stringClassInit = () => jl_String_$callClinit(),
$rt_intern;
{
    $rt_intern = str => str;
}
let $rt_enumConstants = cls => {
    let meta = cls[$rt_meta];
    if (meta.resolvedEnumConstants === null) {
        let result = meta.enumConstants();
        meta.resolvedEnumConstants = result !== null ? result : [];
    }
    return meta.resolvedEnumConstants;
},
$rt_isInstance = (obj, cls) => obj instanceof $rt_objcls() && !!obj.constructor[$rt_meta] && $rt_isAssignable(obj.constructor, cls),
$rt_isAssignable = (from, to) => {
    if (from === to) {
        return true;
    }
    let map = from[$rt_meta].assignableCache;
    if (map === null) {
        map = new Map();
        from[$rt_meta].assignableCache = map;
    }
    let cachedResult = map.get(to);
    if (typeof cachedResult !== 'undefined') {
        return cachedResult;
    }
    if (to[$rt_meta].itemType !== null) {
        let result = from[$rt_meta].itemType !== null && $rt_isAssignable(from[$rt_meta].itemType, to[$rt_meta].itemType);
        map.set(to, result);
        return result;
    }
    let parent = from[$rt_meta].parent;
    if (parent !== null && parent !== from) {
        if ($rt_isAssignable(parent, to)) {
            map.set(to, true);
            return true;
        }
    }
    let superinterfaces = from[$rt_meta].superinterfaces;
    for (let i = 0;i < superinterfaces.length;i = i + 1 | 0) {
        if ($rt_isAssignable(superinterfaces[i], to)) {
            map.set(to, true);
            return true;
        }
    }
    map.set(to, false);
    return false;
},
$rt_throw = ex => {
    throw $rt_exception(ex);
},
$rt_javaExceptionProp = Symbol("javaException"),
$rt_exception = ex => {
    if (!ex.$jsException) {
        $rt_fillNativeException(ex);
    }
    return ex.$jsException;
},
$rt_fillNativeException = ex => {
    let javaCause = $rt_throwableCause(ex);
    let jsCause = javaCause !== null ? javaCause.$jsException : void 0;
    let cause = typeof jsCause === "object" ? { cause : jsCause } : void 0;
    let err = new JavaError("Java exception thrown", cause);
    if (typeof Error.captureStackTrace === "function") {
        Error.captureStackTrace(err);
    }
    err[$rt_javaExceptionProp] = ex;
    ex.$jsException = err;
    $rt_fillStack(err, ex);
},
$rt_fillStack = (err, ex) => {
    if (typeof $rt_decodeStack === "function" && err.stack) {
        let stack = $rt_decodeStack(err.stack);
        let javaStack = $rt_createArray($rt_stecls(), stack.length);
        let elem;
        let noStack = false;
        for (let i = 0;i < stack.length;++i) {
            let element = stack[i];
            elem = $rt_createStackElement($rt_str(element.className), $rt_str(element.methodName), $rt_str(element.fileName), element.lineNumber);
            if (elem == null) {
                noStack = true;
                break;
            }
            javaStack.data[i] = elem;
        }
        if (!noStack) {
            $rt_setStack(ex, javaStack);
        }
    }
},
JavaError;
if (typeof Reflect === 'object') {
    let defaultMessage = Symbol("defaultMessage");
    JavaError = function JavaError(message, cause) {
        let self = Reflect.construct(Error, [void 0, cause], JavaError);
        Object.setPrototypeOf(self, JavaError.prototype);
        self[defaultMessage] = message;
        return self;
    }
    ;
    JavaError.prototype = Object.create(Error.prototype, { constructor : { configurable : true, writable : true, value : JavaError }, message : { get() {
        try {
            let javaException = this[$rt_javaExceptionProp];
            if (typeof javaException === 'object') {
                let javaMessage = $rt_throwableMessage(javaException);
                if (typeof javaMessage === "object") {
                    return javaMessage !== null ? javaMessage.toString() : null;
                }
            }
            return this[defaultMessage];
        } catch (e){
            return "Exception occurred trying to extract Java exception message: " + e;
        }
    } } });
} else {
    JavaError = Error;
}
let $rt_javaException = e => e instanceof Error && typeof e[$rt_javaExceptionProp] === 'object' ? e[$rt_javaExceptionProp] : null,
$rt_wrapException = err => {
    let ex = err[$rt_javaExceptionProp];
    if (!ex) {
        ex = $rt_createException($rt_str("(JavaScript) " + err.toString()));
        err[$rt_javaExceptionProp] = ex;
        ex.$jsException = err;
        $rt_fillStack(err, ex);
    }
    return ex;
},
$rt_createException = message => jl_RuntimeException__init_3(message),
$rt_throwableMessage = t => jl_Throwable_getMessage(t),
$rt_throwableCause = t => jl_Throwable_getCause(t),
$rt_stecls = () => $rt_objcls(),
$rt_createStackElement = (className, methodName, fileName, lineNumber) => {
    {
        return null;
    }
},
$rt_setStack = (e, stack) => {
},
$rt_packageData = null,
$rt_packages = data => {
    let i = 0;
    let packages = new Array(data.length);
    for (let j = 0;j < data.length;++j) {
        let prefixIndex = data[i++];
        let prefix = prefixIndex >= 0 ? packages[prefixIndex] : "";
        packages[j] = prefix + data[i++] + ".";
    }
    $rt_packageData = packages;
},
$rt_allClasses = [],
$rt_metadata = data => {
    let packages = $rt_packageData;
    let i = 0;
    while (i < data.length) {
        let cls = data[i++];
        $rt_allClasses.push(cls);
        let m = $rt_newClassMetadata();
        cls[$rt_meta] = m;
        let className = data[i++];
        m.name = className !== 0 ? className : null;
        if (m.name !== null) {
            let packageIndex = data[i++];
            if (packageIndex >= 0) {
                m.name = packages[packageIndex] + m.name;
            }
        }
        m.binaryName = "L" + m.name + ";";
        let superclass = data[i++];
        m.parent = superclass !== 0 ? superclass : null;
        m.superinterfaces = data[i++];
        if (m.parent) {
            cls.prototype = Object.create(m.parent.prototype);
        } else {
            cls.prototype = {  };
        }
        cls.prototype.constructor = cls;
        m.modifiers = data[i++];
        m.primitiveKind = 0;
        let innerClassInfo = data[i++];
        if (innerClassInfo !== 0) {
            let enclosingClass = innerClassInfo[0];
            m.enclosingClass = enclosingClass !== 0 ? enclosingClass : null;
            let declaringClass = innerClassInfo[1];
            m.declaringClass = declaringClass !== 0 ? declaringClass : null;
            let simpleName = innerClassInfo[2];
            m.simpleName = simpleName !== 0 ? simpleName : null;
        }
        let clinit = data[i++];
        m.clinit = clinit !== 0 ? () => {
            m.clinit = () => {
            };
            clinit();
        } : () => {
        };
        let virtualMethods = data[i++];
        if (virtualMethods !== 0) {
            for (let j = 0;j < virtualMethods.length;j += 2) {
                let name = virtualMethods[j];
                let func = virtualMethods[j + 1];
                if (typeof name === 'string') {
                    name = [name];
                }
                for (let k = 0;k < name.length;++k) {
                    cls.prototype[name[k]] = func;
                }
            }
        }
    }
},
$rt_enumConstantsMetadata = data => {
    let i = 0;
    while (i < data.length) {
        let cls = data[i++];
        cls[$rt_meta].enumConstants = data[i++];
    }
};
function TeaVMThread(runner) {
    this.status = 3;
    this.stack = [];
    this.suspendCallback = null;
    this.runner = runner;
    this.attribute = null;
    this.completeCallback = null;
}
TeaVMThread.prototype.push = function() {
    for (let i = 0;i < arguments.length;++i) {
        this.stack.push(arguments[i]);
    }
    return this;
};
TeaVMThread.prototype.s = TeaVMThread.prototype.push;
TeaVMThread.prototype.pop = function() {
    return this.stack.pop();
};
TeaVMThread.prototype.l = TeaVMThread.prototype.pop;
TeaVMThread.prototype.isResuming = function() {
    return this.status === 2;
};
TeaVMThread.prototype.isSuspending = function() {
    return this.status === 1;
};
TeaVMThread.prototype.suspend = function(callback) {
    this.suspendCallback = callback;
    this.status = 1;
};
TeaVMThread.prototype.start = function(callback) {
    if (this.status !== 3) {
        throw new Error("Thread already started");
    }
    if ($rt_currentNativeThread !== null) {
        throw new Error("Another thread is running");
    }
    this.status = 0;
    this.completeCallback = callback ? callback : result => {
        if (result instanceof Error) {
            throw result;
        }
    };
    this.run();
};
TeaVMThread.prototype.resume = function() {
    if ($rt_currentNativeThread !== null) {
        throw new Error("Another thread is running");
    }
    this.status = 2;
    this.run();
};
TeaVMThread.prototype.run = function() {
    $rt_currentNativeThread = this;
    let result;
    try {
        result = this.runner();
    } catch (e){
        result = e;
    } finally {
        $rt_currentNativeThread = null;
    }
    if (this.suspendCallback !== null) {
        let self = this;
        let callback = this.suspendCallback;
        this.suspendCallback = null;
        callback(() => self.resume());
    } else if (this.status === 0) {
        this.completeCallback(result);
    }
};
let $rt_suspending = () => {
    let thread = $rt_nativeThread();
    return thread != null && thread.isSuspending();
},
$rt_resuming = () => {
    let thread = $rt_nativeThread();
    return thread != null && thread.isResuming();
},
$rt_requireNativeThread = () => {
    let nativeThread = $rt_nativeThread();
    if (nativeThread === null) {
        throw new Error("Suspension point reached from non-threading context " + "(perhaps, from native JS method). See https://teavm.org/docs/runtime/coroutines.html " + "('Interaction with JavaScript' section)");
    }
    return nativeThread;
},
$rt_startThread = (runner, callback) => (new TeaVMThread(runner)).start(callback),
$rt_currentNativeThread = null,
$rt_nativeThread = () => $rt_currentNativeThread,
$rt_invalidPointer = () => {
    throw new Error("Invalid recorded state");
};
function jl_Object() {
    this.$monitor = null;
    this.$id$ = 0;
}
let jl_Object_monitorEnterSync = $o => {
    let var$2;
    if (jl_Thread_currentThread() === null)
        return;
    if ($o.$monitor === null)
        jl_Object_createMonitor($o);
    if ($o.$monitor.$owner === null)
        $o.$monitor.$owner = jl_Thread_currentThread();
    else if ($o.$monitor.$owner !== jl_Thread_currentThread())
        $rt_throw(jl_IllegalStateException__init_2($rt_s(0)));
    var$2 = $o.$monitor;
    var$2.$count = var$2.$count + 1 | 0;
},
jl_Object_monitorExitSync = $o => {
    let var$2, var$3;
    if (jl_Thread_currentThread() === null)
        return;
    if (!jl_Object_isEmptyMonitor($o) && $o.$monitor.$owner === jl_Thread_currentThread()) {
        var$2 = $o.$monitor;
        var$3 = var$2.$count - 1 | 0;
        var$2.$count = var$3;
        if (!var$3)
            $o.$monitor.$owner = null;
        jl_Object_isEmptyMonitor($o);
        return;
    }
    $rt_throw(jl_IllegalMonitorStateException__init_0());
},
jl_Object_monitorEnter0 = $o => {
    let var$2, $ptr, $tmp;
    $ptr = 0;
    if ($rt_resuming()) {
        let $thread = $rt_nativeThread();
        $ptr = $thread.pop();var$2 = $thread.pop();$o = $thread.pop();
    }
    main: while (true) { switch ($ptr) {
    case 0:
        var$2 = 1;
        $ptr = 1;
    case 1:
        jl_Object_monitorEnter($o, var$2);
        if ($rt_suspending()) {
            break main;
        }
        return;
    default: $rt_invalidPointer();
    }}
    $rt_nativeThread().push($o, var$2, $ptr);
},
jl_Object_monitorEnter = ($o, $count) => {
    let var$3, $ptr, $tmp;
    $ptr = 0;
    if ($rt_resuming()) {
        let $thread = $rt_nativeThread();
        $ptr = $thread.pop();var$3 = $thread.pop();$count = $thread.pop();$o = $thread.pop();
    }
    main: while (true) { switch ($ptr) {
    case 0:
        if ($o.$monitor === null)
            jl_Object_createMonitor($o);
        if ($o.$monitor.$owner === null)
            $o.$monitor.$owner = jl_Thread_currentThread();
        if ($o.$monitor.$owner === jl_Thread_currentThread()) {
            var$3 = $o.$monitor;
            var$3.$count = var$3.$count + $count | 0;
            return;
        }
        $ptr = 1;
    case 1:
        jl_Object_monitorEnterWait($o, $count);
        if ($rt_suspending()) {
            break main;
        }
        return;
    default: $rt_invalidPointer();
    }}
    $rt_nativeThread().push($o, $count, var$3, $ptr);
},
jl_Object_createMonitor = $o => {
    $o.$monitor = jl_Object$Monitor__init_0();
},
jl_Object_monitorEnterWait = (var$1, var$2) => {
    let $ptr, $tmp;
    $ptr = 0;
    if ($rt_resuming()) {
        let $thread = $rt_nativeThread();
        $ptr = $thread.pop();var$2 = $thread.pop();var$1 = $thread.pop();
    }
    main: while (true) { switch ($ptr) {
    case 0:
        $ptr = 1;
    case 1:
        jl_Object_monitorEnterWait$_asyncCall_$(var$1, var$2);
        if ($rt_suspending()) {
            break main;
        }
        return;
    default: $rt_invalidPointer();
    }}
    $rt_nativeThread().push(var$1, var$2, $ptr);
},
jl_Object_monitorEnterWait0 = ($o, $count, $callback) => {
    let $thread_0, var$5, $monitor;
    $thread_0 = jl_Thread_currentThread();
    if ($o.$monitor === null) {
        jl_Object_createMonitor($o);
        jl_Thread_setCurrentThread($thread_0);
        var$5 = $o.$monitor;
        var$5.$count = var$5.$count + $count | 0;
        $callback.$complete(null);
        return;
    }
    if ($o.$monitor.$owner === null) {
        $o.$monitor.$owner = $thread_0;
        jl_Thread_setCurrentThread($thread_0);
        var$5 = $o.$monitor;
        var$5.$count = var$5.$count + $count | 0;
        $callback.$complete(null);
        return;
    }
    $monitor = $o.$monitor;
    if ($monitor.$enteringThreads === null)
        $monitor.$enteringThreads = ju_ArrayDeque__init_1();
    $monitor.$enteringThreads.$add(jl_Object$monitorEnterWait$lambda$_6_0__init_0($thread_0, $o, $count, $callback));
},
jl_Object_monitorExit0 = $o => {
    jl_Object_monitorExit($o, 1);
},
jl_Object_monitorExit = ($o, $count) => {
    let $monitor;
    if (!jl_Object_isEmptyMonitor($o) && $o.$monitor.$owner === jl_Thread_currentThread()) {
        $monitor = $o.$monitor;
        $monitor.$count = $monitor.$count - $count | 0;
        if ($monitor.$count > 0)
            return;
        $monitor.$owner = null;
        if ($monitor.$enteringThreads !== null && !$monitor.$enteringThreads.$isEmpty())
            otp_Platform_postpone(jl_Object$monitorExit$lambda$_8_1__init_0($o));
        else
            jl_Object_isEmptyMonitor($o);
        return;
    }
    $rt_throw(jl_IllegalMonitorStateException__init_0());
},
jl_Object_waitForOtherThreads = $o => {
    let $monitor, $enteringThreads, $r;
    if (!jl_Object_isEmptyMonitor($o) && $o.$monitor.$owner === null) {
        $monitor = $o.$monitor;
        if ($monitor.$enteringThreads !== null && !$monitor.$enteringThreads.$isEmpty()) {
            $enteringThreads = $monitor.$enteringThreads;
            $r = $enteringThreads.$remove();
            $monitor.$enteringThreads = null;
            $r.$run();
        }
        return;
    }
},
jl_Object_isEmptyMonitor = $this => {
    let $monitor, var$2;
    $monitor = $this.$monitor;
    if ($monitor === null)
        return 1;
    a: {
        b: {
            if ($monitor.$owner === null) {
                if ($monitor.$enteringThreads !== null) {
                    var$2 = $monitor.$enteringThreads;
                    if (!var$2.$isEmpty())
                        break b;
                }
                if ($monitor.$notifyListeners === null)
                    break a;
                var$2 = $monitor.$notifyListeners;
                if (var$2.$isEmpty())
                    break a;
            }
        }
        return 0;
    }
    jl_Object_deleteMonitor($this);
    return 1;
},
jl_Object_deleteMonitor = $this => {
    $this.$monitor = null;
},
jl_Object__init_ = $this => {
    return;
},
jl_Object__init_0 = () => {
    let var_0 = new jl_Object();
    jl_Object__init_(var_0);
    return var_0;
},
jl_Object_getClass = $this => {
    return $rt_cls(jl_Object_getClassInfo($this));
},
jl_Object_getClassInfo = var$0 => {
    return var$0.constructor;
},
jl_Object_hashCode = var$0 => {
    return jl_Object_identity(var$0);
},
jl_Object_equals = ($this, $other) => {
    return $this !== $other ? 0 : 1;
},
jl_Object_toString = $this => {
    let var$1, var$2, var$3;
    var$1 = jl_Class_getName(jl_Object_getClass($this));
    var$2 = jl_Integer_toHexString(jl_Object_identity($this));
    var$3 = jl_StringBuilder__init_();
    jl_StringBuilder_append(jl_StringBuilder_append0(jl_StringBuilder_append(var$3, var$1), 64), var$2);
    return jl_StringBuilder_toString(var$3);
},
jl_Object_identity = $this => {
    let $platformThis;
    $platformThis = $this;
    if (!$platformThis.$id$)
        $platformThis.$id$ = $rt_nextId();
    return $this.$id$;
},
jl_Object_clone = $this => {
    let $cls, $result, var$3, var$4;
    $cls = jl_Class_getClassInfo(jl_Object_getClass($this));
    if (!$rt_isInstance($this, jl_Cloneable) && $cls[$rt_meta].itemType === null)
        $rt_throw(jl_CloneNotSupportedException__init_0());
    $result = otp_Platform_clone($this);
    var$3 = $result;
    var$4 = $rt_nextId();
    var$3.$id$ = var$4;
    return $result;
},
jl_Object_lambda$monitorExit$2 = $o => {
    jl_Object_waitForOtherThreads($o);
},
jl_Object_lambda$monitorEnterWait$0 = ($thread_0, $o, $count, $callback) => {
    let var$5;
    jl_Thread_setCurrentThread($thread_0);
    $o.$monitor.$owner = $thread_0;
    var$5 = $o.$monitor;
    var$5.$count = var$5.$count + $count | 0;
    $callback.$complete(null);
},
jl_Object_monitorEnterWait$_asyncCall_$ = (var$1, var$2) => {
    let thread = $rt_requireNativeThread();
    let javaThread = $rt_getThread();
    if (thread.isResuming()) {
        thread.status = 0;
        let result = thread.attribute;
        if (result instanceof Error) {
            throw result;
        }
        return result;
    }
    let callback = function() {
    };
    callback.$complete = val => {
        thread.attribute = val;
        $rt_setThread(javaThread);
        thread.resume();
    };
    callback.$error = e => {
        thread.attribute = $rt_exception(e);
        $rt_setThread(javaThread);
        thread.resume();
    };
    callback = otpp_AsyncCallbackWrapper_create(callback);
    thread.suspend(() => {
        try {
            jl_Object_monitorEnterWait0(var$1, var$2, callback);
            ;
        } catch ($e){
            callback.$error($e);
        }
    });
    return null;
};
function jur_AbstractCharClass$LazyCharClass() {
    let a = this; jl_Object.call(a);
    a.$posValue = null;
    a.$negValue = null;
}
let jur_AbstractCharClass$LazyCharClass__init_ = $this => {
    jl_Object__init_($this);
},
jur_AbstractCharClass$LazyCharClass_getValue = ($this, $negative) => {
    if (!$negative && $this.$posValue === null)
        $this.$posValue = $this.$computeValue();
    else if ($negative && $this.$negValue === null)
        $this.$negValue = ($this.$computeValue()).$setNegative(1);
    if ($negative)
        return $this.$negValue;
    return $this.$posValue;
},
jur_AbstractCharClass$LazyBlank = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyBlank__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyBlank__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyBlank();
    jur_AbstractCharClass$LazyBlank__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyBlank_computeValue = $this => {
    return ((jur_CharClass__init_()).$add0(32)).$add0(9);
},
jur_AbstractCharClass$LazyCntrl = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyCntrl__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyCntrl__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyCntrl();
    jur_AbstractCharClass$LazyCntrl__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyCntrl_computeValue = $this => {
    return ((jur_CharClass__init_()).$add1(0, 31)).$add0(127);
};
function jl_Throwable() {
    let a = this; jl_Object.call(a);
    a.$message = null;
    a.$cause = null;
    a.$suppressionEnabled = 0;
    a.$writableStackTrace = 0;
}
let jl_Throwable__init_ = $this => {
    jl_Throwable_initNativeException($this);
    $this.$suppressionEnabled = 1;
    $this.$writableStackTrace = 1;
    $this.$fillInStackTrace();
},
jl_Throwable__init_5 = () => {
    let var_0 = new jl_Throwable();
    jl_Throwable__init_(var_0);
    return var_0;
},
jl_Throwable__init_0 = ($this, $message) => {
    jl_Throwable_initNativeException($this);
    $this.$suppressionEnabled = 1;
    $this.$writableStackTrace = 1;
    $this.$fillInStackTrace();
    $this.$message = $message;
},
jl_Throwable__init_3 = var_0 => {
    let var_1 = new jl_Throwable();
    jl_Throwable__init_0(var_1, var_0);
    return var_1;
},
jl_Throwable__init_2 = ($this, $message, $cause) => {
    jl_Throwable_initNativeException($this);
    $this.$suppressionEnabled = 1;
    $this.$writableStackTrace = 1;
    $this.$fillInStackTrace();
    $this.$message = $message;
    $this.$cause = $cause;
},
jl_Throwable__init_4 = (var_0, var_1) => {
    let var_2 = new jl_Throwable();
    jl_Throwable__init_2(var_2, var_0, var_1);
    return var_2;
},
jl_Throwable__init_1 = ($this, $cause) => {
    jl_Throwable_initNativeException($this);
    $this.$suppressionEnabled = 1;
    $this.$writableStackTrace = 1;
    $this.$fillInStackTrace();
    $this.$cause = $cause;
},
jl_Throwable__init_6 = var_0 => {
    let var_1 = new jl_Throwable();
    jl_Throwable__init_1(var_1, var_0);
    return var_1;
},
jl_Throwable_fillInStackTrace = $this => {
    return $this;
},
jl_Throwable_initNativeException = $this => {
    $rt_fillNativeException($this);
},
jl_Throwable_getMessage = $this => {
    return $this.$message;
},
jl_Throwable_getCause = $this => {
    return $this.$cause === $this ? null : $this.$cause;
},
jl_Exception = $rt_classWithoutFields(jl_Throwable),
jl_Exception__init_0 = $this => {
    jl_Throwable__init_($this);
},
jl_Exception__init_3 = () => {
    let var_0 = new jl_Exception();
    jl_Exception__init_0(var_0);
    return var_0;
},
jl_Exception__init_2 = ($this, $message, $cause) => {
    jl_Throwable__init_2($this, $message, $cause);
},
jl_Exception__init_6 = (var_0, var_1) => {
    let var_2 = new jl_Exception();
    jl_Exception__init_2(var_2, var_0, var_1);
    return var_2;
},
jl_Exception__init_ = ($this, $message) => {
    jl_Throwable__init_0($this, $message);
},
jl_Exception__init_5 = var_0 => {
    let var_1 = new jl_Exception();
    jl_Exception__init_(var_1, var_0);
    return var_1;
},
jl_Exception__init_1 = ($this, $cause) => {
    jl_Throwable__init_1($this, $cause);
},
jl_Exception__init_4 = var_0 => {
    let var_1 = new jl_Exception();
    jl_Exception__init_1(var_1, var_0);
    return var_1;
},
jl_RuntimeException = $rt_classWithoutFields(jl_Exception),
jl_RuntimeException__init_ = $this => {
    jl_Exception__init_0($this);
},
jl_RuntimeException__init_4 = () => {
    let var_0 = new jl_RuntimeException();
    jl_RuntimeException__init_(var_0);
    return var_0;
},
jl_RuntimeException__init_0 = ($this, $message) => {
    jl_Exception__init_($this, $message);
},
jl_RuntimeException__init_3 = var_0 => {
    let var_1 = new jl_RuntimeException();
    jl_RuntimeException__init_0(var_1, var_0);
    return var_1;
},
jl_RuntimeException__init_2 = ($this, $cause) => {
    jl_Exception__init_1($this, $cause);
},
jl_RuntimeException__init_1 = var_0 => {
    let var_1 = new jl_RuntimeException();
    jl_RuntimeException__init_2(var_1, var_0);
    return var_1;
},
jl_IndexOutOfBoundsException = $rt_classWithoutFields(jl_RuntimeException),
jl_IndexOutOfBoundsException__init_0 = $this => {
    jl_RuntimeException__init_($this);
},
jl_IndexOutOfBoundsException__init_ = () => {
    let var_0 = new jl_IndexOutOfBoundsException();
    jl_IndexOutOfBoundsException__init_0(var_0);
    return var_0;
},
jl_IndexOutOfBoundsException__init_2 = ($this, $message) => {
    jl_RuntimeException__init_0($this, $message);
},
jl_IndexOutOfBoundsException__init_1 = var_0 => {
    let var_1 = new jl_IndexOutOfBoundsException();
    jl_IndexOutOfBoundsException__init_2(var_1, var_0);
    return var_1;
};
function owts_Puzzle$PuzzleState() {
    jl_Object.call(this);
    this.$this$07 = null;
}
let owts_Puzzle$PuzzleState__init_ = ($this, $this$0) => {
    $this.$this$07 = $this$0;
    jl_Object__init_($this);
},
owts_Puzzle$PuzzleState_applyAlgorithm = ($this, $algorithm) => {
    let var$2, var$3, var$4, $move, $e, $$je;
    var$2 = (owts_AlgorithmBuilder_splitAlgorithm($algorithm)).data;
    var$3 = var$2.length;
    var$4 = 0;
    while (var$4 < var$3) {
        $move = var$2[var$4];
        try {
            $this = $this.$apply($move);
        } catch ($$e) {
            $$je = $rt_wrapException($$e);
            if ($$je instanceof owts_InvalidMoveException) {
                $e = $$je;
                $rt_throw(owts_InvalidScrambleException__init_($algorithm, $e));
            } else {
                throw $$e;
            }
        }
        var$4 = var$4 + 1 | 0;
    }
    return $this;
},
owts_Puzzle$PuzzleState_getCanonicalMovesByState = $this => {
    let $successorsByName, $uniqueSuccessors, $statesSeenNormalized, var$4, $next, $nextState, $nextStateNormalized, $moveName;
    $successorsByName = $this.$getSuccessorsByName();
    $uniqueSuccessors = ju_HashMap__init_();
    $statesSeenNormalized = ju_HashSet__init_1();
    $statesSeenNormalized.$add($this.$getNormalized());
    var$4 = ($successorsByName.$entrySet()).$iterator();
    while (var$4.$hasNext()) {
        $next = var$4.$next();
        $nextState = $next.$getValue();
        $nextStateNormalized = $nextState.$getNormalized();
        $moveName = $next.$getKey();
        if (!$statesSeenNormalized.$contains($nextStateNormalized)) {
            $uniqueSuccessors.$put($nextState, $moveName);
            $statesSeenNormalized.$add($nextStateNormalized);
        }
    }
    return $uniqueSuccessors;
},
owts_Puzzle$PuzzleState_getNormalized = $this => {
    return $this;
},
owts_Puzzle$PuzzleState_isNormalized = $this => {
    return $this.$equals($this.$getNormalized());
},
owts_Puzzle$PuzzleState_getMoveCost = ($this, $move) => {
    return 1;
},
owts_Puzzle$PuzzleState_equalsNormalized = ($this, $other) => {
    return ($this.$getNormalized()).$equals($other.$getNormalized());
},
owts_Puzzle$PuzzleState_getPuzzle = $this => {
    return $this.$this$07;
},
owts_Puzzle$PuzzleState_isSolved = $this => {
    return $this.$equalsNormalized(($this.$getPuzzle()).$getSolvedState());
},
owts_Puzzle$PuzzleState_apply = ($this, $move) => {
    let $successors;
    $successors = $this.$getSuccessorsByName();
    if ($successors.$containsKey($move))
        return $successors.$get($move);
    $rt_throw(owts_InvalidMoveException__init_0((((jl_StringBuilder__init_()).$append1($rt_s(1))).$append1($move)).$toString()));
},
owts_Puzzle$PuzzleState_solveIn = ($this, $n) => {
    return ($this.$getPuzzle()).$solveIn($this, $n);
},
owts_Puzzle$PuzzleState_movesCommute = ($this, $move1, $move2) => {
    let $state1, $state2, var$5, $$je;
    a: {
        try {
            $state1 = ($this.$apply($move1)).$apply($move2);
            $state2 = ($this.$apply($move2)).$apply($move1);
            var$5 = $state1.$equals($state2);
        } catch ($$e) {
            $$je = $rt_wrapException($$e);
            if ($$je instanceof owts_InvalidMoveException) {
                break a;
            } else {
                throw $$e;
            }
        }
        return var$5;
    }
    return 0;
};
function owtp_PyraminxPuzzle$PyraminxState() {
    let a = this; owts_Puzzle$PuzzleState.call(a);
    a.$image = null;
    a.$this$01 = null;
}
let owtp_PyraminxPuzzle$PyraminxState_$assertionsDisabled = 0,
owtp_PyraminxPuzzle$PyraminxState_$callClinit = () => {
    owtp_PyraminxPuzzle$PyraminxState_$callClinit = $rt_eraseClinit(owtp_PyraminxPuzzle$PyraminxState);
    owtp_PyraminxPuzzle$PyraminxState__clinit_();
},
owtp_PyraminxPuzzle$PyraminxState__init_ = ($this, $this$0) => {
    let $i, $j;
    owtp_PyraminxPuzzle$PyraminxState_$callClinit();
    $this.$this$01 = $this$0;
    owts_Puzzle$PuzzleState__init_($this, $this$0);
    $this.$image = $rt_createIntMultiArray([9, 4]);
    $i = 0;
    while ($i < $this.$image.data.length) {
        $j = 0;
        while ($j < $this.$image.data[0].data.length) {
            $this.$image.data[$i].data[$j] = $i;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
owtp_PyraminxPuzzle$PyraminxState__init_2 = var_0 => {
    let var_1 = new owtp_PyraminxPuzzle$PyraminxState();
    owtp_PyraminxPuzzle$PyraminxState__init_(var_1, var_0);
    return var_1;
},
owtp_PyraminxPuzzle$PyraminxState__init_0 = ($this, $this$0, $image) => {
    owtp_PyraminxPuzzle$PyraminxState_$callClinit();
    $this.$this$01 = $this$0;
    owts_Puzzle$PuzzleState__init_($this, $this$0);
    $this.$image = $image;
},
owtp_PyraminxPuzzle$PyraminxState__init_1 = (var_0, var_1) => {
    let var_2 = new owtp_PyraminxPuzzle$PyraminxState();
    owtp_PyraminxPuzzle$PyraminxState__init_0(var_2, var_0, var_1);
    return var_2;
},
owtp_PyraminxPuzzle$PyraminxState_turn = ($this, $side, $dir, $image) => {
    let $i;
    $i = 0;
    while ($i < $dir) {
        owtp_PyraminxPuzzle$PyraminxState_turn0($this, $side, $image);
        $i = $i + 1 | 0;
    }
},
owtp_PyraminxPuzzle$PyraminxState_turnTip0 = ($this, $side, $dir, $image) => {
    let $i;
    $i = 0;
    while ($i < $dir) {
        owtp_PyraminxPuzzle$PyraminxState_turnTip($this, $side, $image);
        $i = $i + 1 | 0;
    }
},
owtp_PyraminxPuzzle$PyraminxState_turn0 = ($this, $s, $image) => {
    a: {
        b: {
            switch ($s) {
                case 0:
                    break b;
                case 1:
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 2, 8, 1, 2, 0, 8, $image);
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 2, 7, 1, 1, 0, 7, $image);
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 2, 5, 1, 8, 0, 5, $image);
                    break a;
                case 2:
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 3, 8, 0, 5, 1, 5, $image);
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 3, 7, 0, 4, 1, 4, $image);
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 3, 5, 0, 2, 1, 2, $image);
                    break a;
                case 3:
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 1, 8, 2, 2, 3, 5, $image);
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 1, 7, 2, 1, 3, 4, $image);
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 1, 5, 2, 8, 3, 2, $image);
                    break a;
                default:
            }
            owtp_PyraminxPuzzle$PyraminxState_$callClinit();
            if (owtp_PyraminxPuzzle$PyraminxState_$assertionsDisabled)
                break a;
            $rt_throw(jl_AssertionError__init_());
        }
        owtp_PyraminxPuzzle$PyraminxState_swap($this, 0, 8, 3, 8, 2, 2, $image);
        owtp_PyraminxPuzzle$PyraminxState_swap($this, 0, 1, 3, 1, 2, 4, $image);
        owtp_PyraminxPuzzle$PyraminxState_swap($this, 0, 2, 3, 2, 2, 5, $image);
    }
    owtp_PyraminxPuzzle$PyraminxState_turnTip($this, $s, $image);
},
owtp_PyraminxPuzzle$PyraminxState_turnTip = ($this, $s, $image) => {
    a: {
        b: {
            switch ($s) {
                case 0:
                    break b;
                case 1:
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 0, 6, 2, 6, 1, 0, $image);
                    break a;
                case 2:
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 0, 3, 1, 3, 3, 6, $image);
                    break a;
                case 3:
                    owtp_PyraminxPuzzle$PyraminxState_swap($this, 1, 6, 2, 0, 3, 3, $image);
                    break a;
                default:
            }
            owtp_PyraminxPuzzle$PyraminxState_$callClinit();
            if (owtp_PyraminxPuzzle$PyraminxState_$assertionsDisabled)
                break a;
            $rt_throw(jl_AssertionError__init_());
        }
        owtp_PyraminxPuzzle$PyraminxState_swap($this, 0, 0, 3, 0, 2, 3, $image);
    }
},
owtp_PyraminxPuzzle$PyraminxState_swap = ($this, $f1, $s1, $f2, $s2, $f3, $s3, $image) => {
    let var$8, $temp;
    var$8 = $image.data;
    $temp = var$8[$f1].data[$s1];
    var$8[$f1].data[$s1] = var$8[$f2].data[$s2];
    var$8[$f2].data[$s2] = var$8[$f3].data[$s3];
    var$8[$f3].data[$s3] = $temp;
},
owtp_PyraminxPuzzle$PyraminxState_toPyraminxSolverState = $this => {
    let $state, $stickersToEdges, var$3, var$4, var$5, $colorToValue, $edges, $i, var$9, $stickersToCorners, $correctSum, $corners, $stickersToTips, var$14, $tips, $stickers, $cornerPrimaryColor, $clockwiseTurnsToMatchCorner;
    $state = owtp_PyraminxSolver$PyraminxSolverState__init_();
    $stickersToEdges = $rt_createArray($rt_arraycls($rt_intcls), 6);
    var$3 = $stickersToEdges.data;
    var$4 = $rt_createIntArray(2);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[0].data[5];
    var$5[1] = $this.$image.data[1].data[2];
    var$3[0] = var$4;
    var$4 = $rt_createIntArray(2);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[0].data[8];
    var$5[1] = $this.$image.data[2].data[5];
    var$3[1] = var$4;
    var$4 = $rt_createIntArray(2);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[1].data[8];
    var$5[1] = $this.$image.data[2].data[8];
    var$3[2] = var$4;
    var$4 = $rt_createIntArray(2);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[0].data[2];
    var$5[1] = $this.$image.data[3].data[8];
    var$3[3] = var$4;
    var$4 = $rt_createIntArray(2);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[1].data[5];
    var$5[1] = $this.$image.data[3].data[5];
    var$3[4] = var$4;
    var$4 = $rt_createIntArray(2);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[2].data[2];
    var$5[1] = $this.$image.data[3].data[2];
    var$3[5] = var$4;
    $colorToValue = $rt_createIntArray(4);
    var$4 = $colorToValue.data;
    var$4[0] = 0;
    var$4[1] = 1;
    var$4[2] = 2;
    var$4[3] = 4;
    $edges = $rt_createIntArray(6);
    $i = 0;
    while (true) {
        var$9 = $edges.data;
        if ($i >= var$9.length)
            break;
        var$9[$i] = (var$4[var$3[$i].data[0]] + var$4[var$3[$i].data[1]] | 0) - 1 | 0;
        if (var$3[$i].data[0] > var$3[$i].data[1])
            var$9[$i] = var$9[$i] + 8 | 0;
        $i = $i + 1 | 0;
    }
    $state.$edgePerm = owtp_PyraminxSolver_packEdgePerm($edges);
    $state.$edgeOrient = owtp_PyraminxSolver_packEdgeOrient($edges);
    $stickersToCorners = $rt_createArray($rt_arraycls($rt_intcls), 4);
    var$3 = $stickersToCorners.data;
    var$4 = $rt_createIntArray(3);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[0].data[1];
    var$5[1] = $this.$image.data[2].data[4];
    var$5[2] = $this.$image.data[3].data[1];
    var$3[0] = var$4;
    var$4 = $rt_createIntArray(3);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[0].data[7];
    var$5[1] = $this.$image.data[1].data[1];
    var$5[2] = $this.$image.data[2].data[7];
    var$3[1] = var$4;
    var$4 = $rt_createIntArray(3);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[0].data[4];
    var$5[1] = $this.$image.data[3].data[7];
    var$5[2] = $this.$image.data[1].data[4];
    var$3[2] = var$4;
    var$4 = $rt_createIntArray(3);
    var$5 = var$4.data;
    var$5[0] = $this.$image.data[1].data[7];
    var$5[1] = $this.$image.data[3].data[4];
    var$5[2] = $this.$image.data[2].data[1];
    var$3[3] = var$4;
    $correctSum = $rt_createIntArray(4);
    var$4 = $correctSum.data;
    var$4[0] = 5;
    var$4[1] = 3;
    var$4[2] = 4;
    var$4[3] = 6;
    $corners = $rt_createIntArray(4);
    $i = 0;
    while (true) {
        var$9 = $corners.data;
        if ($i >= var$9.length) {
            $state.$cornerOrient = owtp_PyraminxSolver_packCornerOrient($corners);
            $stickersToTips = $rt_createArray($rt_arraycls($rt_intcls), 4);
            var$14 = $stickersToTips.data;
            var$14[0] = $rt_createIntArrayFromData([$this.$image.data[0].data[0], $this.$image.data[2].data[3], $this.$image.data[3].data[0]]);
            var$14[1] = $rt_createIntArrayFromData([$this.$image.data[0].data[6], $this.$image.data[1].data[0], $this.$image.data[2].data[6]]);
            var$14[2] = $rt_createIntArrayFromData([$this.$image.data[0].data[3], $this.$image.data[3].data[6], $this.$image.data[1].data[3]]);
            var$14[3] = $rt_createIntArrayFromData([$this.$image.data[1].data[6], $this.$image.data[3].data[3], $this.$image.data[2].data[0]]);
            $tips = $rt_createIntArray(4);
            $i = 0;
            while (true) {
                var$9 = $tips.data;
                if ($i >= var$9.length)
                    break;
                $stickers = var$14[$i];
                owtp_PyraminxPuzzle$PyraminxState_$callClinit();
                if (!owtp_PyraminxPuzzle$PyraminxState_$assertionsDisabled) {
                    var$5 = $stickers.data;
                    if (((var$5[0] + var$5[1] | 0) + var$5[2] | 0) != var$4[$i])
                        $rt_throw(jl_AssertionError__init_());
                }
                $cornerPrimaryColor = var$3[$i].data[0];
                $clockwiseTurnsToMatchCorner = 0;
                while ($stickers.data[$clockwiseTurnsToMatchCorner] != $cornerPrimaryColor) {
                    $clockwiseTurnsToMatchCorner = $clockwiseTurnsToMatchCorner + 1 | 0;
                    if (owtp_PyraminxPuzzle$PyraminxState_$assertionsDisabled)
                        continue;
                    if ($clockwiseTurnsToMatchCorner >= 3)
                        $rt_throw(jl_AssertionError__init_());
                }
                var$9[$i] = $clockwiseTurnsToMatchCorner;
                $i = $i + 1 | 0;
            }
            $state.$tips = owtp_PyraminxSolver_packCornerOrient($tips);
            return $state;
        }
        owtp_PyraminxPuzzle$PyraminxState_$callClinit();
        if (!owtp_PyraminxPuzzle$PyraminxState_$assertionsDisabled && ((var$3[$i].data[0] + var$3[$i].data[1] | 0) + var$3[$i].data[2] | 0) != var$4[$i])
            break;
        if (var$3[$i].data[0] < var$3[$i].data[1] && var$3[$i].data[0] < var$3[$i].data[2])
            var$9[$i] = 0;
        if (var$3[$i].data[1] < var$3[$i].data[0] && var$3[$i].data[1] < var$3[$i].data[2])
            var$9[$i] = 1;
        if (var$3[$i].data[2] < var$3[$i].data[1] && var$3[$i].data[2] < var$3[$i].data[0])
            var$9[$i] = 2;
        $i = $i + 1 | 0;
    }
    $rt_throw(jl_AssertionError__init_());
},
owtp_PyraminxPuzzle$PyraminxState_solveIn = ($this, $n) => {
    return (owtp_PyraminxPuzzle_access$000($this.$this$01)).$solveIn0($this.$toPyraminxSolverState(), $n, 1);
},
owtp_PyraminxPuzzle$PyraminxState_getSuccessorsByName = $this => {
    let $successors, $axes, $axis, var$4, var$5, var$6, $tip, $face, var$9, $dir, var$11, $turn, $imageCopy;
    $successors = ju_LinkedHashMap__init_();
    $axes = $rt_s(2);
    $axis = 0;
    while ($axis < $axes.$length()) {
        var$4 = $rt_createBooleanArray(2).data;
        var$4[0] = 1;
        var$4[1] = 0;
        var$5 = var$4.length;
        var$6 = 0;
        while (var$6 < var$5) {
            $tip = var$4[var$6];
            $face = $axes.$charAt($axis);
            var$9 = !$tip ? jl_Character_toUpperCase($face) : jl_Character_toLowerCase($face);
            $dir = 1;
            while (true) {
                var$11 = $rt_compare($dir, 2);
                if (var$11 > 0)
                    break;
                $turn = (((jl_StringBuilder__init_()).$append1($rt_s(3))).$append0(var$9)).$toString();
                if (!var$11)
                    $turn = (((jl_StringBuilder__init_()).$append1($turn)).$append1($rt_s(4))).$toString();
                $imageCopy = $rt_createIntMultiArray([$this.$image.data[0].data.length, $this.$image.data.length]);
                owts_Puzzle_deepCopy($this.$image, $imageCopy);
                if (!$tip)
                    owtp_PyraminxPuzzle$PyraminxState_turn($this, $axis, $dir, $imageCopy);
                else
                    owtp_PyraminxPuzzle$PyraminxState_turnTip0($this, $axis, $dir, $imageCopy);
                $successors.$put($turn, owtp_PyraminxPuzzle$PyraminxState__init_1($this.$this$01, $imageCopy));
                $dir = $dir + 1 | 0;
            }
            var$6 = var$6 + 1 | 0;
        }
        $axis = $axis + 1 | 0;
    }
    return $successors;
},
owtp_PyraminxPuzzle$PyraminxState_equals = ($this, $other) => {
    return ju_Arrays_deepEquals($this.$image, $other.$image);
},
owtp_PyraminxPuzzle$PyraminxState_hashCode = $this => {
    return ju_Arrays_deepHashCode($this.$image);
},
owtp_PyraminxPuzzle$PyraminxState__clinit_ = () => {
    owtp_PyraminxPuzzle$PyraminxState_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_PyraminxPuzzle)) ? 0 : 1;
},
jur_SpecialToken = $rt_classWithoutFields(),
jur_SpecialToken__init_ = $this => {
    jl_Object__init_($this);
};
function jur_AbstractCharClass() {
    let a = this; jur_SpecialToken.call(a);
    a.$alt = 0;
    a.$altSurrogates = 0;
    a.$lowHighSurrogates = null;
    a.$charClassWithoutSurrogates = null;
    a.$charClassWithSurrogates = null;
    a.$mayContainSupplCodepoints0 = 0;
}
let jur_AbstractCharClass_charClasses = null,
jur_AbstractCharClass_$callClinit = () => {
    jur_AbstractCharClass_$callClinit = $rt_eraseClinit(jur_AbstractCharClass);
    jur_AbstractCharClass__clinit_();
},
jur_AbstractCharClass__init_ = $this => {
    jur_AbstractCharClass_$callClinit();
    jur_SpecialToken__init_($this);
    $this.$lowHighSurrogates = ju_BitSet__init_2(2048);
},
jur_AbstractCharClass_getBits = $this => {
    return null;
},
jur_AbstractCharClass_getLowHighSurrogates = $this => {
    return $this.$lowHighSurrogates;
},
jur_AbstractCharClass_hasLowHighSurrogates = $this => {
    return !$this.$altSurrogates ? ($this.$lowHighSurrogates.$nextSetBit(0) >= 2048 ? 0 : 1) : $this.$lowHighSurrogates.$nextClearBit(0) >= 2048 ? 0 : 1;
},
jur_AbstractCharClass_mayContainSupplCodepoints = $this => {
    return $this.$mayContainSupplCodepoints0;
},
jur_AbstractCharClass_getInstance = $this => {
    return $this;
},
jur_AbstractCharClass_getSurrogates = $this => {
    let $lHS;
    if ($this.$charClassWithSurrogates === null) {
        $lHS = $this.$getLowHighSurrogates();
        $this.$charClassWithSurrogates = jur_AbstractCharClass$1__init_0($this, $lHS);
        $this.$charClassWithSurrogates.$setNegative($this.$altSurrogates);
    }
    return $this.$charClassWithSurrogates;
},
jur_AbstractCharClass_getWithoutSurrogates = $this => {
    let $lHS;
    if ($this.$charClassWithoutSurrogates === null) {
        $lHS = $this.$getLowHighSurrogates();
        $this.$charClassWithoutSurrogates = jur_AbstractCharClass$2__init_0($this, $lHS, $this);
        $this.$charClassWithoutSurrogates.$setNegative($this.$isNegative());
        $this.$charClassWithoutSurrogates.$mayContainSupplCodepoints0 = $this.$mayContainSupplCodepoints0;
    }
    return $this.$charClassWithoutSurrogates;
},
jur_AbstractCharClass_hasUCI = $this => {
    return 0;
},
jur_AbstractCharClass_setNegative = ($this, $value) => {
    if ($this.$alt ^ $value) {
        $this.$alt = $this.$alt ? 0 : 1;
        $this.$altSurrogates = $this.$altSurrogates ? 0 : 1;
    }
    if (!$this.$mayContainSupplCodepoints0)
        $this.$mayContainSupplCodepoints0 = 1;
    return $this;
},
jur_AbstractCharClass_isNegative = $this => {
    return $this.$alt;
},
jur_AbstractCharClass_intersects0 = ($cc, $ch) => {
    jur_AbstractCharClass_$callClinit();
    return $cc.$contains0($ch);
},
jur_AbstractCharClass_intersects = ($cc1, $cc2) => {
    jur_AbstractCharClass_$callClinit();
    if ($cc1.$getBits() !== null && $cc2.$getBits() !== null)
        return ($cc1.$getBits()).$intersects($cc2.$getBits());
    return 1;
},
jur_AbstractCharClass_getPredefinedClass = ($name, $negative) => {
    jur_AbstractCharClass_$callClinit();
    return (jur_AbstractCharClass$PredefinedCharacterClasses_getObject(jur_AbstractCharClass_charClasses, $name)).$getValue0($negative);
},
jur_AbstractCharClass__clinit_ = () => {
    jur_AbstractCharClass_charClasses = jur_AbstractCharClass$PredefinedCharacterClasses__init_0();
};
function jur_AbstractCharClass$LazyJavaWhitespace$1() {
    jur_AbstractCharClass.call(this);
    this.$this$032 = null;
}
let jur_AbstractCharClass$LazyJavaWhitespace$1__init_ = ($this, $this$0) => {
    $this.$this$032 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaWhitespace$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaWhitespace$1();
    jur_AbstractCharClass$LazyJavaWhitespace$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaWhitespace$1_contains = ($this, $ch) => {
    return jl_Character_isWhitespace($ch);
},
jur_AbstractCharClass$LazyJavaJavaIdentifierStart = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaJavaIdentifierStart__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaJavaIdentifierStart__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaJavaIdentifierStart();
    jur_AbstractCharClass$LazyJavaJavaIdentifierStart__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaJavaIdentifierStart_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
},
ji_Serializable = $rt_classWithoutFields(0),
jl_Number = $rt_classWithoutFields(),
jl_Number__init_ = $this => {
    jl_Object__init_($this);
},
jl_Comparable = $rt_classWithoutFields(0);
function jl_Integer() {
    jl_Number.call(this);
    this.$value6 = 0;
}
let jl_Integer_TYPE = null,
jl_Integer_integerCache = null,
jl_Integer_$callClinit = () => {
    jl_Integer_$callClinit = $rt_eraseClinit(jl_Integer);
    jl_Integer__clinit_();
},
jl_Integer__init_ = ($this, $value) => {
    jl_Integer_$callClinit();
    jl_Number__init_($this);
    $this.$value6 = $value;
},
jl_Integer__init_0 = var_0 => {
    let var_1 = new jl_Integer();
    jl_Integer__init_(var_1, var_0);
    return var_1;
},
jl_Integer_toString0 = ($i, $radix) => {
    jl_Integer_$callClinit();
    if (!($radix >= 2 && $radix <= 36))
        $radix = 10;
    return ((jl_AbstractStringBuilder__init_1(20)).$append2($i, $radix)).$toString();
},
jl_Integer_hashCode = $value => {
    jl_Integer_$callClinit();
    return $value;
},
jl_Integer_toHexString = $i => {
    jl_Integer_$callClinit();
    return otci_IntegerUtil_toUnsignedLogRadixString($i, 4);
},
jl_Integer_toString = $i => {
    jl_Integer_$callClinit();
    return jl_Integer_toString0($i, 10);
},
jl_Integer_parseInt = ($s, $radix) => {
    jl_Integer_$callClinit();
    if ($s !== null)
        return jl_Integer_parseIntImpl($s, 0, $s.$length(), $radix);
    $rt_throw(jl_NumberFormatException__init_0($rt_s(5)));
},
jl_Integer_parseIntImpl = ($s, $beginIndex, $endIndex, $radix) => {
    let $negative, var$6, $value, $maxValue, var$9, $digit, var$11, var$12, var$13, var$14;
    jl_Integer_$callClinit();
    if ($beginIndex == $endIndex)
        $rt_throw(jl_NumberFormatException__init_0($rt_s(6)));
    if ($radix >= 2 && $radix <= 36) {
        a: {
            $negative = 0;
            switch ($s.$charAt($beginIndex)) {
                case 43:
                    var$6 = $beginIndex + 1 | 0;
                    break a;
                case 45:
                    $negative = 1;
                    var$6 = $beginIndex + 1 | 0;
                    break a;
                default:
            }
            var$6 = $beginIndex;
        }
        $value = 0;
        $maxValue = 1 + (2147483647 / $radix | 0) | 0;
        if (var$6 == $endIndex)
            $rt_throw(jl_NumberFormatException__init_2());
        while (true) {
            if (var$6 >= $endIndex) {
                if ($negative)
                    $value =  -$value | 0;
                return $value;
            }
            var$9 = var$6 + 1 | 0;
            $digit = jl_Integer_decodeDigit($s.$charAt(var$6));
            if ($digit < 0) {
                var$11 = new jl_NumberFormatException;
                var$12 = jl_String_valueOf($s.$subSequence($beginIndex, $endIndex));
                var$13 = jl_StringBuilder__init_();
                jl_StringBuilder_append(jl_StringBuilder_append(var$13, $rt_s(7)), var$12);
                jl_NumberFormatException__init_(var$11, jl_StringBuilder_toString(var$13));
                $rt_throw(var$11);
            }
            if ($digit >= $radix) {
                var$12 = new jl_NumberFormatException;
                var$13 = jl_String_valueOf($s.$subSequence($beginIndex, $endIndex));
                var$14 = jl_StringBuilder__init_();
                jl_StringBuilder_append(jl_StringBuilder_append(jl_StringBuilder_append1(jl_StringBuilder_append(var$14, $rt_s(8)), $radix), $rt_s(9)), var$13);
                jl_NumberFormatException__init_(var$12, jl_StringBuilder_toString(var$14));
                $rt_throw(var$12);
            }
            if ($value > $maxValue)
                break;
            $value = $rt_imul($radix, $value) + $digit | 0;
            if ($value < 0) {
                if (var$9 == $endIndex && $value == (-2147483648) && $negative)
                    return (-2147483648);
                var$11 = new jl_NumberFormatException;
                var$12 = jl_String_valueOf($s.$subSequence($beginIndex, $endIndex));
                var$13 = jl_StringBuilder__init_();
                jl_StringBuilder_append(jl_StringBuilder_append(var$13, $rt_s(10)), var$12);
                jl_NumberFormatException__init_(var$11, jl_StringBuilder_toString(var$13));
                $rt_throw(var$11);
            }
            var$6 = var$9;
        }
        $rt_throw(jl_NumberFormatException__init_0($rt_s(11)));
    }
    var$11 = new jl_NumberFormatException;
    var$12 = jl_StringBuilder__init_();
    jl_StringBuilder_append1(jl_StringBuilder_append(var$12, $rt_s(12)), $radix);
    jl_NumberFormatException__init_(var$11, jl_StringBuilder_toString(var$12));
    $rt_throw(var$11);
},
jl_Integer_parseInt0 = $s => {
    jl_Integer_$callClinit();
    return jl_Integer_parseInt($s, 10);
},
jl_Integer_valueOf = $i => {
    jl_Integer_$callClinit();
    if ($i >= (-128) && $i <= 127) {
        jl_Integer_ensureIntegerCache();
        return jl_Integer_integerCache.data[$i + 128 | 0];
    }
    return jl_Integer__init_0($i);
},
jl_Integer_ensureIntegerCache = () => {
    let $j;
    jl_Integer_$callClinit();
    a: {
        if (jl_Integer_integerCache === null) {
            jl_Integer_integerCache = $rt_createArray(jl_Integer, 256);
            $j = 0;
            while (true) {
                if ($j >= jl_Integer_integerCache.data.length)
                    break a;
                jl_Integer_integerCache.data[$j] = jl_Integer__init_0($j - 128 | 0);
                $j = $j + 1 | 0;
            }
        }
    }
},
jl_Integer_intValue = $this => {
    return $this.$value6;
},
jl_Integer_decodeDigit = $c => {
    jl_Integer_$callClinit();
    if ($c >= 48 && $c <= 57)
        return $c - 48 | 0;
    if ($c >= 97 && $c <= 122)
        return ($c - 97 | 0) + 10 | 0;
    if ($c >= 65 && $c <= 90)
        return ($c - 65 | 0) + 10 | 0;
    return (-1);
},
jl_Integer_numberOfLeadingZeros = $i => {
    let $n, var$3, var$4;
    jl_Integer_$callClinit();
    if (!$i)
        return 32;
    $n = 0;
    var$3 = $i >>> 16 | 0;
    if (var$3)
        $n = 16;
    else
        var$3 = $i;
    var$4 = var$3 >>> 8 | 0;
    if (!var$4)
        var$4 = var$3;
    else
        $n = $n | 8;
    var$3 = var$4 >>> 4 | 0;
    if (!var$3)
        var$3 = var$4;
    else
        $n = $n | 4;
    var$4 = var$3 >>> 2 | 0;
    if (!var$4)
        var$4 = var$3;
    else
        $n = $n | 2;
    if (var$4 >>> 1 | 0)
        $n = $n | 1;
    return (32 - $n | 0) - 1 | 0;
},
jl_Integer_numberOfTrailingZeros = $i => {
    let $n, var$3, var$4;
    jl_Integer_$callClinit();
    if (!$i)
        return 32;
    $n = 0;
    var$3 = $i << 16;
    if (var$3)
        $n = 16;
    else
        var$3 = $i;
    var$4 = var$3 << 8;
    if (!var$4)
        var$4 = var$3;
    else
        $n = $n | 8;
    var$3 = var$4 << 4;
    if (!var$3)
        var$3 = var$4;
    else
        $n = $n | 4;
    var$4 = var$3 << 2;
    if (!var$4)
        var$4 = var$3;
    else
        $n = $n | 2;
    if (var$4 << 1)
        $n = $n | 1;
    return (32 - $n | 0) - 1 | 0;
},
jl_Integer_highestOneBit = $i => {
    jl_Integer_$callClinit();
    return $i & ((-2147483648) >>> jl_Integer_numberOfLeadingZeros($i) | 0);
},
jl_Integer_rotateLeft = ($i, $distance) => {
    let var$3;
    jl_Integer_$callClinit();
    var$3 = $distance & 31;
    return $i << var$3 | ($i >>> (32 - var$3 | 0) | 0);
},
jl_Integer_toUnsignedLong = $n => {
    jl_Integer_$callClinit();
    return Long_and(Long_fromInt($n), Long_create(4294967295, 0));
},
jl_Integer__clinit_ = () => {
    jl_Integer_TYPE = $rt_cls($rt_intcls);
};
function owtp_CubePuzzle$CubeState() {
    let a = this; owts_Puzzle$PuzzleState.call(a);
    a.$image0 = null;
    a.$normalizedState = null;
    a.$this$0 = null;
}
let owtp_CubePuzzle$CubeState_$assertionsDisabled = 0,
owtp_CubePuzzle$CubeState_$callClinit = () => {
    owtp_CubePuzzle$CubeState_$callClinit = $rt_eraseClinit(owtp_CubePuzzle$CubeState);
    owtp_CubePuzzle$CubeState__clinit_();
},
owtp_CubePuzzle$CubeState__init_1 = ($this, $this$0) => {
    let $face, $j, $k;
    owtp_CubePuzzle$CubeState_$callClinit();
    $this.$this$0 = $this$0;
    owts_Puzzle$PuzzleState__init_($this, $this$0);
    $this.$normalizedState = null;
    $this.$image0 = $rt_createIntMultiArray([$this$0.$size0, $this$0.$size0, 6]);
    $face = 0;
    while ($face < $this.$image0.data.length) {
        $j = 0;
        while ($j < $this$0.$size0) {
            $k = 0;
            while ($k < $this$0.$size0) {
                $this.$image0.data[$face].data[$j].data[$k] = $face;
                $k = $k + 1 | 0;
            }
            $j = $j + 1 | 0;
        }
        $face = $face + 1 | 0;
    }
    $this.$normalizedState = $this;
},
owtp_CubePuzzle$CubeState__init_2 = var_0 => {
    let var_1 = new owtp_CubePuzzle$CubeState();
    owtp_CubePuzzle$CubeState__init_1(var_1, var_0);
    return var_1;
},
owtp_CubePuzzle$CubeState__init_ = ($this, $this$0, $image) => {
    owtp_CubePuzzle$CubeState_$callClinit();
    $this.$this$0 = $this$0;
    owts_Puzzle$PuzzleState__init_($this, $this$0);
    $this.$normalizedState = null;
    $this.$image0 = $image;
},
owtp_CubePuzzle$CubeState__init_0 = (var_0, var_1) => {
    let var_2 = new owtp_CubePuzzle$CubeState();
    owtp_CubePuzzle$CubeState__init_(var_2, var_0, var_1);
    return var_2;
},
owtp_CubePuzzle$CubeState_isNormalized = $this => {
    return owtp_CubePuzzle_access$200($this.$this$0, $this.$image0);
},
owtp_CubePuzzle$CubeState_getNormalized0 = $this => {
    let $normalizedImage;
    if ($this.$normalizedState === null) {
        $normalizedImage = owtp_CubePuzzle_access$300($this.$this$0, $this.$image0);
        $this.$normalizedState = owtp_CubePuzzle$CubeState__init_0($this.$this$0, $normalizedImage);
    }
    return $this.$normalizedState;
},
owtp_CubePuzzle$CubeState_toTwoByTwoState = $this => {
    let $state, $stickersByPiece, var$3, $dColor, $bColor, $lColor, $uColor, $fColor, $rColor, $colorToVal, var$11, $pieces, $i, var$14, $stickers, var$16, $pieceVal, $clockwiseTurnsToGetToPrimaryColor, $piece;
    $state = owtp_TwoByTwoSolver$TwoByTwoState__init_0();
    $stickersByPiece = owtp_CubePuzzle_getStickersByPiece($this.$image0);
    var$3 = $stickersByPiece.data;
    $dColor = var$3[7].data[0];
    $bColor = var$3[7].data[1];
    $lColor = var$3[7].data[2];
    $uColor = jl_Enum_ordinal(owtp_CubePuzzle$Face_oppositeFace((owtp_CubePuzzle$Face_values()).data[$dColor]));
    $fColor = jl_Enum_ordinal(owtp_CubePuzzle$Face_oppositeFace((owtp_CubePuzzle$Face_values()).data[$bColor]));
    $rColor = jl_Enum_ordinal(owtp_CubePuzzle$Face_oppositeFace((owtp_CubePuzzle$Face_values()).data[$lColor]));
    $colorToVal = $rt_createIntArray(8);
    var$11 = $colorToVal.data;
    var$11[$uColor] = 0;
    var$11[$fColor] = 0;
    var$11[$rColor] = 0;
    var$11[$lColor] = 1;
    var$11[$bColor] = 2;
    var$11[$dColor] = 4;
    $pieces = $rt_createIntArray(7);
    $i = 0;
    a: while (true) {
        var$14 = $pieces.data;
        if ($i >= var$14.length) {
            $state.$permutation = owtp_TwoByTwoSolver_packPerm($pieces);
            $state.$orientation = owtp_TwoByTwoSolver_packOrient($pieces);
            return $state;
        }
        $stickers = var$3[$i];
        var$16 = $stickers.data;
        $pieceVal = (var$11[var$16[0]] + var$11[var$16[1]] | 0) + var$11[var$16[2]] | 0;
        $clockwiseTurnsToGetToPrimaryColor = 0;
        while (var$16[$clockwiseTurnsToGetToPrimaryColor] != $uColor && var$16[$clockwiseTurnsToGetToPrimaryColor] != $dColor) {
            $clockwiseTurnsToGetToPrimaryColor = $clockwiseTurnsToGetToPrimaryColor + 1 | 0;
            owtp_CubePuzzle$CubeState_$callClinit();
            if (owtp_CubePuzzle$CubeState_$assertionsDisabled)
                continue;
            if ($clockwiseTurnsToGetToPrimaryColor >= 3)
                break a;
        }
        $piece = ($clockwiseTurnsToGetToPrimaryColor << 3) + $pieceVal | 0;
        var$14[$i] = $piece;
        $i = $i + 1 | 0;
    }
    $rt_throw(jl_AssertionError__init_());
},
owtp_CubePuzzle$CubeState_toFaceCube = $this => {
    let $state, var$2, var$3, var$4, $f, $face, $faceArr, var$8, var$9, var$10, $faceState, var$12, var$13, var$14, $piece;
    owtp_CubePuzzle$CubeState_$callClinit();
    if (!owtp_CubePuzzle$CubeState_$assertionsDisabled && $this.$this$0.$size0 != 3)
        $rt_throw(jl_AssertionError__init_());
    $state = jl_StringBuilder__init_();
    var$2 = ($rt_s(13).$toCharArray()).data;
    var$3 = var$2.length;
    var$4 = 0;
    while (var$4 < var$3) {
        $f = var$2[var$4];
        $face = owtp_CubePuzzle$Face_valueOf((((jl_StringBuilder__init_()).$append1($rt_s(3))).$append0($f)).$toString());
        $faceArr = $this.$image0.data[jl_Enum_ordinal($face)];
        var$8 = $faceArr.data;
        var$9 = var$8.length;
        var$10 = 0;
        while (var$10 < var$9) {
            $faceState = var$8[var$10];
            var$12 = $faceState.data;
            var$13 = var$12.length;
            var$14 = 0;
            while (var$14 < var$13) {
                $piece = var$12[var$14];
                $state.$append1((owtp_CubePuzzle$Face_values()).data[$piece].$toString());
                var$14 = var$14 + 1 | 0;
            }
            var$10 = var$10 + 1 | 0;
        }
        var$4 = var$4 + 1 | 0;
    }
    return $state.$toString();
},
owtp_CubePuzzle$CubeState_getSuccessorsByName = $this => {
    return owtp_CubePuzzle$CubeState_getSuccessorsWithinSlice($this, $this.$this$0.$size0 - 1 | 0, 1);
},
owtp_CubePuzzle$CubeState_getScrambleSuccessors = $this => {
    return owtp_CubePuzzle$CubeState_getSuccessorsWithinSlice($this, ($this.$this$0.$size0 / 2 | 0) - 1 | 0, 0);
},
owtp_CubePuzzle$CubeState_getCanonicalMovesByState = $this => {
    let $reversed, var$2, $entry;
    $reversed = ju_HashMap__init_();
    var$2 = (($this.$getScrambleSuccessors()).$entrySet()).$iterator();
    while (var$2.$hasNext()) {
        $entry = var$2.$next();
        $reversed.$put($entry.$getValue(), $entry.$getKey());
    }
    return $reversed;
},
owtp_CubePuzzle$CubeState_getSuccessorsWithinSlice = ($this, $maxSlice, $includeRedundant) => {
    let $successors, $innerSlice, var$5, var$6, var$7, $face, $halfOfEvenCube, $outerSlice, $dir, $move, $moveStr, $imageCopy, $slice;
    $successors = ju_LinkedHashMap__init_();
    $innerSlice = 0;
    while ($innerSlice <= $maxSlice) {
        var$5 = (owtp_CubePuzzle$Face_values()).data;
        var$6 = var$5.length;
        var$7 = 0;
        while (var$7 < var$6) {
            $face = var$5[var$7];
            $halfOfEvenCube = !($this.$this$0.$size0 % 2 | 0) && $innerSlice == (($this.$this$0.$size0 / 2 | 0) - 1 | 0) ? 1 : 0;
            a: {
                if (!(!$includeRedundant && jl_Enum_ordinal($face) >= 3 && $halfOfEvenCube)) {
                    $outerSlice = 0;
                    $dir = 1;
                    while (true) {
                        if ($dir > 3)
                            break a;
                        $move = owtp_CubePuzzle$CubeMove__init_0($this.$this$0, $face, $dir, $innerSlice, $outerSlice);
                        $moveStr = $move.$toString();
                        if ($moveStr !== null) {
                            $imageCopy = owtp_CubePuzzle_access$400($this.$this$0, $this.$image0);
                            $slice = $outerSlice;
                            while ($slice <= $innerSlice) {
                                owtp_CubePuzzle_access$500($face, $slice, $dir, $imageCopy);
                                $slice = $slice + 1 | 0;
                            }
                            $successors.$put($moveStr, owtp_CubePuzzle$CubeState__init_0($this.$this$0, $imageCopy));
                        }
                        $dir = $dir + 1 | 0;
                    }
                }
            }
            var$7 = var$7 + 1 | 0;
        }
        $innerSlice = $innerSlice + 1 | 0;
    }
    return $successors;
},
owtp_CubePuzzle$CubeState_equals = ($this, $other) => {
    return ju_Arrays_deepEquals($this.$image0, $other.$image0);
},
owtp_CubePuzzle$CubeState_hashCode = $this => {
    return ju_Arrays_deepHashCode($this.$image0);
},
owtp_CubePuzzle$CubeState_getNormalized = $this => {
    return $this.$getNormalized0();
},
owtp_CubePuzzle$CubeState__clinit_ = () => {
    owtp_CubePuzzle$CubeState_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_CubePuzzle)) ? 0 : 1;
},
jl_CloneNotSupportedException = $rt_classWithoutFields(jl_Exception),
jl_CloneNotSupportedException__init_ = $this => {
    jl_Exception__init_0($this);
},
jl_CloneNotSupportedException__init_0 = () => {
    let var_0 = new jl_CloneNotSupportedException();
    jl_CloneNotSupportedException__init_(var_0);
    return var_0;
};
function jur_AbstractSet() {
    let a = this; jl_Object.call(a);
    a.$next3 = null;
    a.$isSecondPassVisited = 0;
    a.$index3 = null;
    a.$type = 0;
}
let jur_AbstractSet_counter = 0,
jur_AbstractSet_$callClinit = () => {
    jur_AbstractSet_$callClinit = $rt_eraseClinit(jur_AbstractSet);
    jur_AbstractSet__clinit_();
},
jur_AbstractSet__init_ = $this => {
    let var$1;
    jur_AbstractSet_$callClinit();
    jl_Object__init_($this);
    var$1 = jur_AbstractSet_counter;
    jur_AbstractSet_counter = var$1 + 1 | 0;
    $this.$index3 = jl_Integer_toString(var$1);
},
jur_AbstractSet__init_0 = ($this, $n) => {
    let var$2;
    jur_AbstractSet_$callClinit();
    jl_Object__init_($this);
    var$2 = jur_AbstractSet_counter;
    jur_AbstractSet_counter = var$2 + 1 | 0;
    $this.$index3 = jl_Integer_toString(var$2);
    $this.$next3 = $n;
},
jur_AbstractSet_find = ($this, $stringIndex, $testString, $matchResult) => {
    let $length;
    $length = $matchResult.$getRightBound();
    while (true) {
        if ($stringIndex > $length)
            return (-1);
        if ($this.$matches($stringIndex, $testString, $matchResult) >= 0)
            break;
        $stringIndex = $stringIndex + 1 | 0;
    }
    return $stringIndex;
},
jur_AbstractSet_findBack = ($this, $stringIndex, $startSearch, $testString, $matchResult) => {
    while (true) {
        if ($startSearch < $stringIndex)
            return (-1);
        if ($this.$matches($startSearch, $testString, $matchResult) >= 0)
            break;
        $startSearch = $startSearch + (-1) | 0;
    }
    return $startSearch;
},
jur_AbstractSet_setType = ($this, $type) => {
    $this.$type = $type;
},
jur_AbstractSet_getType = $this => {
    return $this.$type;
},
jur_AbstractSet_getNext = $this => {
    return $this.$next3;
},
jur_AbstractSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_AbstractSet_first = ($this, $set) => {
    return 1;
},
jur_AbstractSet_processBackRefReplacement = $this => {
    return null;
},
jur_AbstractSet_processSecondPass = $this => {
    let $set;
    $this.$isSecondPassVisited = 1;
    if ($this.$next3 !== null) {
        if (!$this.$next3.$isSecondPassVisited) {
            $set = $this.$next3.$processBackRefReplacement();
            if ($set !== null) {
                $this.$next3.$isSecondPassVisited = 1;
                $this.$next3 = $set;
            }
            $this.$next3.$processSecondPass();
        } else if ($this.$next3 instanceof jur_SingleSet && $this.$next3.$fSet.$isBackReferenced)
            $this.$next3 = $this.$next3.$next3;
    }
},
jur_AbstractSet__clinit_ = () => {
    jur_AbstractSet_counter = 1;
};
function jur_JointSet() {
    let a = this; jur_AbstractSet.call(a);
    a.$children = null;
    a.$fSet = null;
    a.$groupIndex = 0;
}
let jur_JointSet__init_ = $this => {
    jur_AbstractSet__init_($this);
},
jur_JointSet__init_2 = () => {
    let var_0 = new jur_JointSet();
    jur_JointSet__init_(var_0);
    return var_0;
},
jur_JointSet__init_0 = ($this, $children, $fSet) => {
    jur_AbstractSet__init_($this);
    $this.$children = $children;
    $this.$fSet = $fSet;
    $this.$groupIndex = $fSet.$getGroupIndex();
},
jur_JointSet__init_1 = (var_0, var_1) => {
    let var_2 = new jur_JointSet();
    jur_JointSet__init_0(var_2, var_0, var_1);
    return var_2;
},
jur_JointSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $start, $size, $i, $e, $shift;
    if ($this.$children === null)
        return (-1);
    $start = $matchResult.$getStart($this.$groupIndex);
    $matchResult.$setStart($this.$groupIndex, $stringIndex);
    $size = $this.$children.$size();
    $i = 0;
    while (true) {
        if ($i >= $size) {
            $matchResult.$setStart($this.$groupIndex, $start);
            return (-1);
        }
        $e = $this.$children.$get0($i);
        $shift = $e.$matches($stringIndex, $testString, $matchResult);
        if ($shift >= 0)
            break;
        $i = $i + 1 | 0;
    }
    return $shift;
},
jur_JointSet_setNext = ($this, $next) => {
    $this.$fSet.$setNext($next);
},
jur_JointSet_first = ($this, $set) => {
    let $i;
    a: {
        if ($this.$children !== null) {
            $i = $this.$children.$iterator();
            while (true) {
                if (!$i.$hasNext())
                    break a;
                if (!($i.$next()).$first($set))
                    continue;
                else
                    return 1;
            }
        }
    }
    return 0;
},
jur_JointSet_hasConsumed = ($this, $matchResult) => {
    let var$2, var$3;
    a: {
        if ($matchResult.$getEnd($this.$groupIndex) >= 0) {
            var$2 = $matchResult.$getStart($this.$groupIndex);
            var$3 = $this.$groupIndex;
            if (var$2 == $matchResult.$getEnd(var$3)) {
                var$2 = 0;
                break a;
            }
        }
        var$2 = 1;
    }
    return var$2;
},
jur_JointSet_processSecondPass = $this => {
    let $childrenSize, $i, $child, $set;
    $this.$isSecondPassVisited = 1;
    if ($this.$fSet !== null && !$this.$fSet.$isSecondPassVisited)
        $this.$fSet.$processSecondPass();
    a: {
        if ($this.$children !== null) {
            $childrenSize = $this.$children.$size();
            $i = 0;
            while (true) {
                if ($i >= $childrenSize)
                    break a;
                $child = $this.$children.$get0($i);
                $set = $child.$processBackRefReplacement();
                if ($set === null)
                    $set = $child;
                else {
                    $child.$isSecondPassVisited = 1;
                    $this.$children.$remove0($i);
                    $this.$children.$add2($i, $set);
                }
                if (!$set.$isSecondPassVisited)
                    $set.$processSecondPass();
                $i = $i + 1 | 0;
            }
        }
    }
    if ($this.$next3 !== null)
        jur_AbstractSet_processSecondPass($this);
};
function jur_SingleSet() {
    jur_JointSet.call(this);
    this.$kid = null;
}
let jur_SingleSet__init_ = ($this, $child, $fSet) => {
    jur_JointSet__init_($this);
    $this.$kid = $child;
    $this.$fSet = $fSet;
    $this.$groupIndex = $fSet.$getGroupIndex();
},
jur_SingleSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_SingleSet();
    jur_SingleSet__init_(var_2, var_0, var_1);
    return var_2;
},
jur_SingleSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $start, $shift;
    $start = $matchResult.$getStart($this.$groupIndex);
    $matchResult.$setStart($this.$groupIndex, $stringIndex);
    $shift = $this.$kid.$matches($stringIndex, $testString, $matchResult);
    if ($shift >= 0)
        return $shift;
    $matchResult.$setStart($this.$groupIndex, $start);
    return (-1);
},
jur_SingleSet_find = ($this, $stringIndex, $testString, $matchResult) => {
    let $res;
    $res = $this.$kid.$find($stringIndex, $testString, $matchResult);
    if ($res >= 0)
        $matchResult.$setStart($this.$groupIndex, $res);
    return $res;
},
jur_SingleSet_findBack = ($this, $stringIndex, $lastIndex, $testString, $matchResult) => {
    let $res;
    $res = $this.$kid.$findBack($stringIndex, $lastIndex, $testString, $matchResult);
    if ($res >= 0)
        $matchResult.$setStart($this.$groupIndex, $res);
    return $res;
},
jur_SingleSet_first = ($this, $set) => {
    return $this.$kid.$first($set);
},
jur_SingleSet_processBackRefReplacement = $this => {
    let $set;
    $set = jur_BackReferencedSingleSet__init_0($this);
    $this.$next3 = $set;
    return $set;
},
jur_SingleSet_processSecondPass = $this => {
    let $set;
    $this.$isSecondPassVisited = 1;
    if ($this.$fSet !== null && !$this.$fSet.$isSecondPassVisited)
        $this.$fSet.$processSecondPass();
    if ($this.$kid !== null && !$this.$kid.$isSecondPassVisited) {
        $set = $this.$kid.$processBackRefReplacement();
        if ($set !== null) {
            $this.$kid.$isSecondPassVisited = 1;
            $this.$kid = $set;
        }
        $this.$kid.$processSecondPass();
    }
},
jl_Long = $rt_classWithoutFields(jl_Number),
jl_Long_TYPE = null,
jl_Long_$callClinit = () => {
    jl_Long_$callClinit = $rt_eraseClinit(jl_Long);
    jl_Long__clinit_();
},
jl_Long_hashCode = $value => {
    jl_Long_$callClinit();
    return Long_lo($value) ^ Long_hi($value);
},
jl_Long__clinit_ = () => {
    jl_Long_TYPE = $rt_cls($rt_longcls);
},
ju_Map = $rt_classWithoutFields(0),
jl_Runnable = $rt_classWithoutFields(0);
function jl_Thread() {
    let a = this; jl_Object.call(a);
    a.$id = Long_ZERO;
    a.$timeSliceStart = Long_ZERO;
    a.$finishedLock = null;
    a.$key1 = null;
    a.$name3 = null;
    a.$alive = 0;
    a.$target = null;
}
let jl_Thread_mainThread = null,
jl_Thread_currentThread0 = null,
jl_Thread_nextId = 0,
jl_Thread_activeCount = 0,
jl_Thread_defaultUncaughtExceptionHandler = null,
jl_Thread_$callClinit = () => {
    jl_Thread_$callClinit = $rt_eraseClinit(jl_Thread);
    jl_Thread__clinit_();
},
jl_Thread__init_0 = ($this, $name) => {
    jl_Thread_$callClinit();
    jl_Thread__init_($this, null, $name);
},
jl_Thread__init_1 = var_0 => {
    let var_1 = new jl_Thread();
    jl_Thread__init_0(var_1, var_0);
    return var_1;
},
jl_Thread__init_ = ($this, $target, $name) => {
    let var$3;
    jl_Thread_$callClinit();
    jl_Object__init_($this);
    $this.$finishedLock = jl_Object__init_0();
    $this.$alive = 1;
    $this.$name3 = $name;
    $this.$target = $target;
    var$3 = jl_Thread_nextId;
    jl_Thread_nextId = var$3 + 1 | 0;
    $this.$id = Long_fromInt(var$3);
},
jl_Thread__init_2 = (var_0, var_1) => {
    let var_2 = new jl_Thread();
    jl_Thread__init_(var_2, var_0, var_1);
    return var_2;
},
jl_Thread_setCurrentThread = $thread_0 => {
    jl_Thread_$callClinit();
    if (jl_Thread_currentThread0 !== $thread_0)
        jl_Thread_currentThread0 = $thread_0;
    jl_Thread_currentThread0.$timeSliceStart = jl_System_currentTimeMillis();
},
jl_Thread_getMainThread = () => {
    jl_Thread_$callClinit();
    return jl_Thread_mainThread;
},
jl_Thread_currentThread = () => {
    jl_Thread_$callClinit();
    return jl_Thread_currentThread0;
},
jl_Thread_getId = $this => {
    return $this.$id;
},
jl_Thread__clinit_ = () => {
    jl_Thread_mainThread = jl_Thread__init_1($rt_s(14));
    jl_Thread_currentThread0 = jl_Thread_mainThread;
    jl_Thread_nextId = 1;
    jl_Thread_activeCount = 1;
    jl_Thread_defaultUncaughtExceptionHandler = jl_DefaultUncaughtExceptionHandler__init_0();
};
function owtp_SkewbPuzzle$SkewbState() {
    let a = this; owts_Puzzle$PuzzleState.call(a);
    a.$image1 = null;
    a.$this$04 = null;
}
let owtp_SkewbPuzzle$SkewbState_$assertionsDisabled = 0,
owtp_SkewbPuzzle$SkewbState_$callClinit = () => {
    owtp_SkewbPuzzle$SkewbState_$callClinit = $rt_eraseClinit(owtp_SkewbPuzzle$SkewbState);
    owtp_SkewbPuzzle$SkewbState__clinit_();
},
owtp_SkewbPuzzle$SkewbState__init_0 = ($this, $this$0) => {
    let $i, $j;
    owtp_SkewbPuzzle$SkewbState_$callClinit();
    $this.$this$04 = $this$0;
    owts_Puzzle$PuzzleState__init_($this, $this$0);
    $this.$image1 = $rt_createIntMultiArray([5, 6]);
    $i = 0;
    while ($i < 6) {
        $j = 0;
        while ($j < 5) {
            $this.$image1.data[$i].data[$j] = $i;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
owtp_SkewbPuzzle$SkewbState__init_1 = var_0 => {
    let var_1 = new owtp_SkewbPuzzle$SkewbState();
    owtp_SkewbPuzzle$SkewbState__init_0(var_1, var_0);
    return var_1;
},
owtp_SkewbPuzzle$SkewbState__init_ = ($this, $this$0, $_image) => {
    let $i;
    owtp_SkewbPuzzle$SkewbState_$callClinit();
    $this.$this$04 = $this$0;
    owts_Puzzle$PuzzleState__init_($this, $this$0);
    $this.$image1 = $rt_createIntMultiArray([5, 6]);
    $i = 0;
    while ($i < 6) {
        jl_System_fastArraycopy($_image.data[$i], 0, $this.$image1.data[$i], 0, 5);
        $i = $i + 1 | 0;
    }
},
owtp_SkewbPuzzle$SkewbState__init_2 = (var_0, var_1) => {
    let var_2 = new owtp_SkewbPuzzle$SkewbState();
    owtp_SkewbPuzzle$SkewbState__init_(var_2, var_0, var_1);
    return var_2;
},
owtp_SkewbPuzzle$SkewbState_turn = ($this, $axis, $pow, $image) => {
    let $p;
    $p = 0;
    while ($p < $pow) {
        a: {
            switch ($axis) {
                case 0:
                    owtp_SkewbPuzzle$SkewbState_swap($this, 2, 0, 3, 0, 1, 0, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 2, 4, 3, 2, 1, 3, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 2, 2, 3, 1, 1, 4, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 2, 3, 3, 4, 1, 1, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 4, 4, 5, 3, 0, 4, $image);
                    break a;
                case 1:
                    owtp_SkewbPuzzle$SkewbState_swap($this, 0, 0, 1, 0, 5, 0, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 0, 2, 1, 2, 5, 1, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 0, 4, 1, 4, 5, 2, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 0, 1, 1, 1, 5, 3, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 4, 1, 2, 2, 3, 4, $image);
                    break a;
                case 2:
                    owtp_SkewbPuzzle$SkewbState_swap($this, 4, 0, 5, 0, 3, 0, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 4, 3, 5, 4, 3, 3, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 4, 1, 5, 3, 3, 1, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 4, 4, 5, 2, 3, 4, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 2, 3, 0, 1, 1, 4, $image);
                    break a;
                case 3:
                    owtp_SkewbPuzzle$SkewbState_swap($this, 1, 0, 3, 0, 5, 0, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 1, 4, 3, 4, 5, 3, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 1, 3, 3, 3, 5, 1, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 1, 2, 3, 2, 5, 4, $image);
                    owtp_SkewbPuzzle$SkewbState_swap($this, 0, 2, 2, 4, 4, 3, $image);
                    break a;
                default:
            }
            owtp_SkewbPuzzle$SkewbState_$callClinit();
            if (!owtp_SkewbPuzzle$SkewbState_$assertionsDisabled)
                $rt_throw(jl_AssertionError__init_());
        }
        $p = $p + 1 | 0;
    }
},
owtp_SkewbPuzzle$SkewbState_swap = ($this, $f1, $s1, $f2, $s2, $f3, $s3, $image) => {
    let var$8, $temp;
    var$8 = $image.data;
    $temp = var$8[$f1].data[$s1];
    var$8[$f1].data[$s1] = var$8[$f2].data[$s2];
    var$8[$f2].data[$s2] = var$8[$f3].data[$s3];
    var$8[$f3].data[$s3] = $temp;
},
owtp_SkewbPuzzle$SkewbState_getSuccessorsByName = $this => {
    let $successors, $axes, $axis, $face, $pow, var$6, $turn, var$8, $imageCopy;
    $successors = ju_LinkedHashMap__init_();
    $axes = $rt_s(15);
    $axis = 0;
    while ($axis < $axes.$length()) {
        $face = $axes.$charAt($axis);
        $pow = 1;
        while (true) {
            var$6 = $rt_compare($pow, 2);
            if (var$6 > 0)
                break;
            $turn = (((jl_StringBuilder__init_()).$append1($rt_s(3))).$append0($face)).$toString();
            if (!var$6)
                $turn = (((jl_StringBuilder__init_()).$append1($turn)).$append1($rt_s(4))).$toString();
            var$8 = $this.$image1.data.length;
            $imageCopy = $rt_createIntMultiArray([$this.$image1.data[0].data.length, var$8]);
            owts_Puzzle_deepCopy($this.$image1, $imageCopy);
            owtp_SkewbPuzzle$SkewbState_turn($this, $axis, $pow, $imageCopy);
            $successors.$put($turn, owtp_SkewbPuzzle$SkewbState__init_2($this.$this$04, $imageCopy));
            $pow = $pow + 1 | 0;
        }
        $axis = $axis + 1 | 0;
    }
    return $successors;
},
owtp_SkewbPuzzle$SkewbState_equals = ($this, $other) => {
    return ju_Arrays_deepEquals($this.$image1, $other.$image1);
},
owtp_SkewbPuzzle$SkewbState_hashCode = $this => {
    return ju_Arrays_deepHashCode($this.$image1);
},
owtp_SkewbPuzzle$SkewbState__clinit_ = () => {
    owtp_SkewbPuzzle$SkewbState_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_SkewbPuzzle)) ? 0 : 1;
};
function jur_SequenceSet$IntHash() {
    let a = this; jl_Object.call(a);
    a.$table = null;
    a.$values0 = null;
    a.$mask = 0;
    a.$size5 = 0;
}
let jur_SequenceSet$IntHash__init_0 = ($this, $size) => {
    jl_Object__init_($this);
    while ($size >= $this.$mask) {
        $this.$mask = $this.$mask << 1 | 1;
    }
    $this.$mask = $this.$mask << 1 | 1;
    $this.$table = $rt_createIntArray($this.$mask + 1 | 0);
    $this.$values0 = $rt_createIntArray($this.$mask + 1 | 0);
    $this.$size5 = $size;
},
jur_SequenceSet$IntHash__init_ = var_0 => {
    let var_1 = new jur_SequenceSet$IntHash();
    jur_SequenceSet$IntHash__init_0(var_1, var_0);
    return var_1;
},
jur_SequenceSet$IntHash_put = ($this, $key, $value) => {
    let $i, $hashCode, var$5;
    $i = 0;
    $hashCode = $key & $this.$mask;
    while ($this.$table.data[$hashCode] && $this.$table.data[$hashCode] != $key) {
        var$5 = $i + 1 | 0;
        $i = var$5 & $this.$mask;
        var$5 = $hashCode + $i | 0;
        $hashCode = var$5 & $this.$mask;
    }
    $this.$table.data[$hashCode] = $key;
    $this.$values0.data[$hashCode] = $value;
},
jur_SequenceSet$IntHash_get = ($this, $key) => {
    let $hashCode, $i, $storedKey, var$5;
    $hashCode = $key & $this.$mask;
    $i = 0;
    while (true) {
        $storedKey = $this.$table.data[$hashCode];
        if (!$storedKey)
            break;
        if ($storedKey == $key)
            return $this.$values0.data[$hashCode];
        var$5 = $i + 1 | 0;
        $i = var$5 & $this.$mask;
        var$5 = $hashCode + $i | 0;
        $hashCode = var$5 & $this.$mask;
    }
    return $this.$size5;
},
jur_AbstractCharClass$LazyAlpha = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyAlpha__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyAlpha__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyAlpha();
    jur_AbstractCharClass$LazyAlpha__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyAlpha_computeValue = $this => {
    return ((jur_CharClass__init_()).$add1(97, 122)).$add1(65, 90);
},
jur_AbstractCharClass$LazyDigit = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyDigit__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyDigit__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyDigit();
    jur_AbstractCharClass$LazyDigit__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyDigit_computeValue = $this => {
    return (jur_CharClass__init_()).$add1(48, 57);
},
jur_AbstractCharClass$LazyNonDigit = $rt_classWithoutFields(jur_AbstractCharClass$LazyDigit),
jur_AbstractCharClass$LazyNonDigit__init_ = $this => {
    jur_AbstractCharClass$LazyDigit__init_($this);
},
jur_AbstractCharClass$LazyNonDigit__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyNonDigit();
    jur_AbstractCharClass$LazyNonDigit__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyNonDigit_computeValue = $this => {
    let $chCl;
    $chCl = (jur_AbstractCharClass$LazyDigit_computeValue($this)).$setNegative(1);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
},
jur_BackReferencedSingleSet = $rt_classWithoutFields(jur_SingleSet),
jur_BackReferencedSingleSet__init_ = ($this, $node) => {
    jur_SingleSet__init_($this, $node.$kid, $node.$fSet);
},
jur_BackReferencedSingleSet__init_0 = var_0 => {
    let var_1 = new jur_BackReferencedSingleSet();
    jur_BackReferencedSingleSet__init_(var_1, var_0);
    return var_1;
},
jur_BackReferencedSingleSet_find = ($this, $startSearch, $testString, $matchResult) => {
    let $res, $lastIndex, $saveStart;
    $res = 0;
    $lastIndex = $matchResult.$getRightBound();
    a: {
        while (true) {
            if ($startSearch > $lastIndex) {
                $startSearch = $res;
                break a;
            }
            $saveStart = $matchResult.$getStart($this.$groupIndex);
            $matchResult.$setStart($this.$groupIndex, $startSearch);
            $res = $this.$kid.$matches($startSearch, $testString, $matchResult);
            if ($res >= 0)
                break;
            $matchResult.$setStart($this.$groupIndex, $saveStart);
            $startSearch = $startSearch + 1 | 0;
        }
    }
    return $startSearch;
},
jur_BackReferencedSingleSet_findBack = ($this, $stringIndex, $startSearch, $testString, $matchResult) => {
    let $res, $saveStart;
    $res = 0;
    a: {
        while (true) {
            if ($startSearch < $stringIndex) {
                $startSearch = $res;
                break a;
            }
            $saveStart = $matchResult.$getStart($this.$groupIndex);
            $matchResult.$setStart($this.$groupIndex, $startSearch);
            $res = $this.$kid.$matches($startSearch, $testString, $matchResult);
            if ($res >= 0)
                break;
            $matchResult.$setStart($this.$groupIndex, $saveStart);
            $startSearch = $startSearch + (-1) | 0;
        }
    }
    return $startSearch;
},
jur_BackReferencedSingleSet_processBackRefReplacement = $this => {
    return null;
};
function owts_Puzzle$Bucket() {
    let a = this; jl_Object.call(a);
    a.$contents = null;
    a.$value1 = 0;
}
let owts_Puzzle$Bucket__init_ = ($this, $value) => {
    jl_Object__init_($this);
    $this.$value1 = $value;
    $this.$contents = ju_LinkedList__init_0();
},
owts_Puzzle$Bucket__init_0 = var_0 => {
    let var_1 = new owts_Puzzle$Bucket();
    owts_Puzzle$Bucket__init_(var_1, var_0);
    return var_1;
},
owts_Puzzle$Bucket_getValue = $this => {
    return $this.$value1;
},
owts_Puzzle$Bucket_pop = $this => {
    return $this.$contents.$removeLast();
},
owts_Puzzle$Bucket_push = ($this, $element) => {
    $this.$contents.$addLast($element);
},
owts_Puzzle$Bucket_isEmpty = $this => {
    return $this.$contents.$isEmpty();
},
owts_Puzzle$Bucket_compareTo0 = ($this, $other) => {
    return $this.$value1 - $other.$value1 | 0;
},
owts_Puzzle$Bucket_compareTo = ($this, var$1) => {
    return $this.$compareTo(var$1);
};
function jur_CIBackReferenceSet() {
    let a = this; jur_JointSet.call(a);
    a.$referencedGroup = 0;
    a.$consCounter1 = 0;
}
let jur_CIBackReferenceSet__init_ = ($this, $groupIndex, $consCounter) => {
    jur_JointSet__init_($this);
    $this.$referencedGroup = $groupIndex;
    $this.$consCounter1 = $consCounter;
},
jur_CIBackReferenceSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_CIBackReferenceSet();
    jur_CIBackReferenceSet__init_(var_2, var_0, var_1);
    return var_2;
},
jur_CIBackReferenceSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $group, $i, var$6, var$7;
    $group = $this.$getString($matchResult);
    if ($group !== null && ($stringIndex + $group.$length() | 0) <= $matchResult.$getRightBound()) {
        $i = 0;
        while (true) {
            if ($i >= $group.$length()) {
                $matchResult.$setConsumed($this.$consCounter1, $group.$length());
                return $this.$next3.$matches($stringIndex + $group.$length() | 0, $testString, $matchResult);
            }
            var$6 = $group.$charAt($i);
            var$7 = $stringIndex + $i | 0;
            if (var$6 != $testString.$charAt(var$7) && jur_Pattern_getSupplement($group.$charAt($i)) != $testString.$charAt(var$7))
                break;
            $i = $i + 1 | 0;
        }
        return (-1);
    }
    return (-1);
},
jur_CIBackReferenceSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_CIBackReferenceSet_getString = ($this, $matchResult) => {
    let $res;
    $res = $matchResult.$getGroupNoCheck($this.$referencedGroup);
    return $res;
},
jur_CIBackReferenceSet_hasConsumed = ($this, $matchResult) => {
    let $res;
    $res = !$matchResult.$getConsumed($this.$consCounter1) ? 0 : 1;
    $matchResult.$setConsumed($this.$consCounter1, (-1));
    return $res;
},
jur_AbstractCharClass$LazyWord = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyWord__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyWord__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyWord();
    jur_AbstractCharClass$LazyWord__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyWord_computeValue = $this => {
    return ((((jur_CharClass__init_()).$add1(97, 122)).$add1(65, 90)).$add1(48, 57)).$add0(95);
},
jur_AbstractCharClass$LazyNonWord = $rt_classWithoutFields(jur_AbstractCharClass$LazyWord),
jur_AbstractCharClass$LazyNonWord__init_ = $this => {
    jur_AbstractCharClass$LazyWord__init_($this);
},
jur_AbstractCharClass$LazyNonWord__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyNonWord();
    jur_AbstractCharClass$LazyNonWord__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyNonWord_computeValue = $this => {
    let $chCl;
    $chCl = (jur_AbstractCharClass$LazyWord_computeValue($this)).$setNegative(1);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function jur_AbstractCharClass$1() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$lHS = null;
    a.$this$031 = null;
}
let jur_AbstractCharClass$1__init_ = ($this, $this$0, var$2) => {
    $this.$this$031 = $this$0;
    $this.$val$lHS = var$2;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$1__init_0 = (var_0, var_1) => {
    let var_2 = new jur_AbstractCharClass$1();
    jur_AbstractCharClass$1__init_(var_2, var_0, var_1);
    return var_2;
},
jur_AbstractCharClass$1_contains = ($this, $ch) => {
    let $index;
    $index = $ch - 55296 | 0;
    return $index >= 0 && $index < 2048 ? $this.$altSurrogates ^ $this.$val$lHS.$get1($index) : 0;
};
function jur_AbstractCharClass$2() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$lHS0 = null;
    a.$val$thisClass = null;
    a.$this$022 = null;
}
let jur_AbstractCharClass$2__init_ = ($this, $this$0, var$2, var$3) => {
    $this.$this$022 = $this$0;
    $this.$val$lHS0 = var$2;
    $this.$val$thisClass = var$3;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$2__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_AbstractCharClass$2();
    jur_AbstractCharClass$2__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_AbstractCharClass$2_contains = ($this, $ch) => {
    let $index, $containslHS;
    $index = $ch - 55296 | 0;
    $containslHS = $index >= 0 && $index < 2048 ? $this.$altSurrogates ^ $this.$val$lHS0.$get1($index) : 0;
    return $this.$val$thisClass.$contains0($ch) && !$containslHS ? 1 : 0;
},
jur_AbstractCharClass$LazyJavaLowerCase = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaLowerCase__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaLowerCase__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaLowerCase();
    jur_AbstractCharClass$LazyJavaLowerCase__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaLowerCase_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaLowerCase$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function jur_LeafSet() {
    jur_AbstractSet.call(this);
    this.$charCount0 = 0;
}
let jur_LeafSet__init_0 = ($this, $next) => {
    jur_AbstractSet__init_0($this, $next);
    $this.$charCount0 = 1;
    $this.$setType(1);
},
jur_LeafSet__init_ = $this => {
    jur_AbstractSet__init_($this);
    $this.$charCount0 = 1;
},
jur_LeafSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $shift;
    if (($stringIndex + $this.$charCount() | 0) > $matchResult.$getRightBound()) {
        $matchResult.$hitEnd = 1;
        return (-1);
    }
    $shift = $this.$accepts($stringIndex, $testString);
    if ($shift < 0)
        return (-1);
    return $this.$next3.$matches($stringIndex + $shift | 0, $testString, $matchResult);
},
jur_LeafSet_charCount = $this => {
    return $this.$charCount0;
},
jur_LeafSet_hasConsumed = ($this, $mr) => {
    return 1;
};
function jur_CISequenceSet() {
    jur_LeafSet.call(this);
    this.$string1 = null;
}
let jur_CISequenceSet__init_ = ($this, $substring) => {
    jur_LeafSet__init_($this);
    $this.$string1 = $substring.$toString();
    $this.$charCount0 = $substring.$length();
},
jur_CISequenceSet__init_0 = var_0 => {
    let var_1 = new jur_CISequenceSet();
    jur_CISequenceSet__init_(var_1, var_0);
    return var_1;
},
jur_CISequenceSet_accepts = ($this, $strIndex, $testString) => {
    let $i, var$4, var$5, var$6;
    $i = 0;
    while (true) {
        if ($i >= $this.$string1.$length())
            return $this.$string1.$length();
        var$4 = $this.$string1.$charAt($i);
        var$5 = $strIndex + $i | 0;
        if (var$4 != $testString.$charAt(var$5)) {
            var$6 = $this.$string1;
            if (jur_Pattern_getSupplement(var$6.$charAt($i)) != $testString.$charAt(var$5))
                break;
        }
        $i = $i + 1 | 0;
    }
    return (-1);
};
function jur_QuantifierSet() {
    jur_AbstractSet.call(this);
    this.$innerSet = null;
}
let jur_QuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_AbstractSet__init_0($this, $next);
    $this.$innerSet = $innerSet;
    $this.$setType($type);
},
jur_QuantifierSet_getInnerSet = $this => {
    return $this.$innerSet;
},
jur_QuantifierSet_first = ($this, $set) => {
    return !$this.$innerSet.$first($set) && !$this.$next3.$first($set) ? 0 : 1;
},
jur_QuantifierSet_hasConsumed = ($this, $mr) => {
    return 1;
},
jur_QuantifierSet_processSecondPass = $this => {
    let $set;
    $this.$isSecondPassVisited = 1;
    if ($this.$next3 !== null && !$this.$next3.$isSecondPassVisited) {
        $set = $this.$next3.$processBackRefReplacement();
        if ($set !== null) {
            $this.$next3.$isSecondPassVisited = 1;
            $this.$next3 = $set;
        }
        $this.$next3.$processSecondPass();
    }
    if ($this.$innerSet !== null) {
        if (!$this.$innerSet.$isSecondPassVisited) {
            $set = $this.$innerSet.$processBackRefReplacement();
            if ($set !== null) {
                $this.$innerSet.$isSecondPassVisited = 1;
                $this.$innerSet = $set;
            }
            $this.$innerSet.$processSecondPass();
        } else if ($this.$innerSet instanceof jur_SingleSet && $this.$innerSet.$fSet.$isBackReferenced)
            $this.$innerSet = $this.$innerSet.$next3;
    }
};
function jur_LeafQuantifierSet() {
    jur_QuantifierSet.call(this);
    this.$leaf = null;
}
let jur_LeafQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_QuantifierSet__init_($this, $innerSet, $next, $type);
    $this.$leaf = $innerSet;
},
jur_LeafQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_LeafQuantifierSet();
    jur_LeafQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_LeafQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $i, var$5;
    $i = 0;
    a: {
        while (($stringIndex + $this.$leaf.$charCount() | 0) <= $matchResult.$getRightBound()) {
            var$5 = $this.$leaf.$accepts($stringIndex, $testString);
            if (var$5 <= 0)
                break a;
            $stringIndex = $stringIndex + var$5 | 0;
            $i = $i + 1 | 0;
        }
    }
    while (true) {
        if ($i < 0)
            return (-1);
        var$5 = $this.$next3.$matches($stringIndex, $testString, $matchResult);
        if (var$5 >= 0)
            break;
        $stringIndex = $stringIndex - $this.$leaf.$charCount() | 0;
        $i = $i + (-1) | 0;
    }
    return var$5;
};
function jur_CompositeQuantifierSet() {
    jur_LeafQuantifierSet.call(this);
    this.$quantifier = null;
}
let jur_CompositeQuantifierSet__init_ = ($this, $quant, $innerSet, $next, $type) => {
    jur_LeafQuantifierSet__init_($this, $innerSet, $next, $type);
    $this.$quantifier = $quant;
},
jur_CompositeQuantifierSet__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_CompositeQuantifierSet();
    jur_CompositeQuantifierSet__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_CompositeQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $min, $max, $i, $shift;
    $min = $this.$quantifier.$min();
    $max = $this.$quantifier.$max();
    $i = 0;
    while (true) {
        if ($i >= $min) {
            a: {
                while ($i < $max) {
                    if (($stringIndex + $this.$leaf.$charCount() | 0) > $matchResult.$getRightBound())
                        break a;
                    $shift = $this.$leaf.$accepts($stringIndex, $testString);
                    if ($shift < 1)
                        break a;
                    $stringIndex = $stringIndex + $shift | 0;
                    $i = $i + 1 | 0;
                }
            }
            while (true) {
                if ($i < $min)
                    return (-1);
                $shift = $this.$next3.$matches($stringIndex, $testString, $matchResult);
                if ($shift >= 0)
                    break;
                $stringIndex = $stringIndex - $this.$leaf.$charCount() | 0;
                $i = $i + (-1) | 0;
            }
            return $shift;
        }
        if (($stringIndex + $this.$leaf.$charCount() | 0) > $matchResult.$getRightBound()) {
            $matchResult.$hitEnd = 1;
            return (-1);
        }
        $shift = $this.$leaf.$accepts($stringIndex, $testString);
        if ($shift < 1)
            break;
        $stringIndex = $stringIndex + $shift | 0;
        $i = $i + 1 | 0;
    }
    return (-1);
},
jur_PossessiveCompositeQuantifierSet = $rt_classWithoutFields(jur_CompositeQuantifierSet),
jur_PossessiveCompositeQuantifierSet__init_ = ($this, $quant, $innerSet, $next, $type) => {
    jur_CompositeQuantifierSet__init_($this, $quant, $innerSet, $next, $type);
},
jur_PossessiveCompositeQuantifierSet__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_PossessiveCompositeQuantifierSet();
    jur_PossessiveCompositeQuantifierSet__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_PossessiveCompositeQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $min, $max, $i, $shift;
    $min = $this.$quantifier.$min();
    $max = $this.$quantifier.$max();
    $i = 0;
    while (true) {
        if ($i >= $min) {
            a: {
                while (true) {
                    if ($i >= $max)
                        break a;
                    if (($stringIndex + $this.$leaf.$charCount() | 0) > $matchResult.$getRightBound())
                        break a;
                    $shift = $this.$leaf.$accepts($stringIndex, $testString);
                    if ($shift < 1)
                        break;
                    $stringIndex = $stringIndex + $shift | 0;
                    $i = $i + 1 | 0;
                }
            }
            return $this.$next3.$matches($stringIndex, $testString, $matchResult);
        }
        if (($stringIndex + $this.$leaf.$charCount() | 0) > $matchResult.$getRightBound()) {
            $matchResult.$hitEnd = 1;
            return (-1);
        }
        $shift = $this.$leaf.$accepts($stringIndex, $testString);
        if ($shift < 1)
            break;
        $stringIndex = $stringIndex + $shift | 0;
        $i = $i + 1 | 0;
    }
    return (-1);
},
jl_CharSequence = $rt_classWithoutFields(0),
ju_SequencedMap = $rt_classWithoutFields(0),
jl_StringIndexOutOfBoundsException = $rt_classWithoutFields(jl_IndexOutOfBoundsException),
jl_StringIndexOutOfBoundsException__init_0 = $this => {
    jl_IndexOutOfBoundsException__init_0($this);
},
jl_StringIndexOutOfBoundsException__init_ = () => {
    let var_0 = new jl_StringIndexOutOfBoundsException();
    jl_StringIndexOutOfBoundsException__init_0(var_0);
    return var_0;
};
function ju_MissingResourceException() {
    let a = this; jl_RuntimeException.call(a);
    a.$className = null;
    a.$key2 = null;
}
let ju_MissingResourceException__init_ = ($this, $s, $className, $key) => {
    jl_RuntimeException__init_0($this, $s);
    $this.$className = $className;
    $this.$key2 = $key;
},
ju_MissingResourceException__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new ju_MissingResourceException();
    ju_MissingResourceException__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
ju_Comparator = $rt_classWithoutFields(0);
function ju_TreeMap$ensureRevertedComparator$lambda$_5_0() {
    jl_Object.call(this);
    this.$_01 = null;
}
let ju_TreeMap$ensureRevertedComparator$lambda$_5_0__init_ = (var$0, var$1) => {
    jl_Object__init_(var$0);
    var$0.$_01 = var$1;
},
ju_TreeMap$ensureRevertedComparator$lambda$_5_0__init_0 = var_0 => {
    let var_1 = new ju_TreeMap$ensureRevertedComparator$lambda$_5_0();
    ju_TreeMap$ensureRevertedComparator$lambda$_5_0__init_(var_1, var_0);
    return var_1;
};
function owts_PuzzleStateAndGenerator() {
    let a = this; jl_Object.call(a);
    a.$state = null;
    a.$generator = null;
}
let owts_PuzzleStateAndGenerator__init_0 = ($this, $state, $generator) => {
    jl_Object__init_($this);
    $this.$state = $state;
    $this.$generator = $generator;
},
owts_PuzzleStateAndGenerator__init_ = (var_0, var_1) => {
    let var_2 = new owts_PuzzleStateAndGenerator();
    owts_PuzzleStateAndGenerator__init_0(var_2, var_0, var_1);
    return var_2;
};
function jur_AbstractCharClass$LazyJavaLetterOrDigit$1() {
    jur_AbstractCharClass.call(this);
    this.$this$033 = null;
}
let jur_AbstractCharClass$LazyJavaLetterOrDigit$1__init_ = ($this, $this$0) => {
    $this.$this$033 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaLetterOrDigit$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaLetterOrDigit$1();
    jur_AbstractCharClass$LazyJavaLetterOrDigit$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaLetterOrDigit$1_contains = ($this, $ch) => {
    return jl_Character_isLetterOrDigit($ch);
};
function jur_CharClass$18() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$bs = null;
    a.$this$016 = null;
}
let jur_CharClass$18__init_ = ($this, $this$0, var$2) => {
    $this.$this$016 = $this$0;
    $this.$val$bs = var$2;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$18__init_0 = (var_0, var_1) => {
    let var_2 = new jur_CharClass$18();
    jur_CharClass$18__init_(var_2, var_0, var_1);
    return var_2;
},
jur_CharClass$18_contains = ($this, $ch) => {
    return $this.$alt ^ $this.$val$bs.$get1($ch);
},
jur_CharClass$18_toString = $this => {
    let $temp, $i;
    $temp = jl_StringBuilder__init_();
    $i = $this.$val$bs.$nextSetBit(0);
    while ($i >= 0) {
        $temp.$append4(jl_Character_toChars($i));
        $temp.$append0(124);
        $i = $this.$val$bs.$nextSetBit($i + 1 | 0);
    }
    if ($temp.$length() > 0)
        $temp.$deleteCharAt($temp.$length() - 1 | 0);
    return $temp.$toString();
},
jur_GroupQuantifierSet = $rt_classWithoutFields(jur_QuantifierSet),
jur_GroupQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_QuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_GroupQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_GroupQuantifierSet();
    jur_GroupQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_GroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $nextIndex;
    if (!$this.$innerSet.$hasConsumed($matchResult))
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    if ($nextIndex >= 0)
        return $nextIndex;
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_PossessiveGroupQuantifierSet = $rt_classWithoutFields(jur_GroupQuantifierSet),
jur_PossessiveGroupQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_GroupQuantifierSet__init_($this, $innerSet, $next, $type);
    jur_FSet_$callClinit();
    $innerSet.$setNext(jur_FSet_posFSet);
},
jur_PossessiveGroupQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_PossessiveGroupQuantifierSet();
    jur_PossessiveGroupQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_PossessiveGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $stringIndex_0;
    while (true) {
        $stringIndex_0 = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
        if ($stringIndex_0 <= 0)
            break;
        $stringIndex = $stringIndex_0;
    }
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
};
function ju_AbstractMap() {
    jl_Object.call(this);
    this.$cachedKeySet = null;
}
let ju_AbstractMap__init_ = $this => {
    jl_Object__init_($this);
},
ju_AbstractMap_put = ($this, $key, $value) => {
    $rt_throw(jl_UnsupportedOperationException__init_0());
},
ju_SortedMap = $rt_classWithoutFields(0),
ju_NavigableMap = $rt_classWithoutFields(0);
function ju_TreeMap$MapView() {
    let a = this; ju_AbstractMap.call(a);
    a.$owner0 = null;
    a.$from = null;
    a.$fromIncluded = 0;
    a.$fromChecked = 0;
    a.$to = null;
    a.$toIncluded = 0;
    a.$toChecked = 0;
    a.$reverse = 0;
    a.$cachedNavigableKeySet = null;
}
let ju_TreeMap$MapView__init_ = ($this, $owner, $from, $fromIncluded, $fromChecked, $to, $toIncluded, $toChecked, $reverse) => {
    ju_AbstractMap__init_($this);
    ju_TreeMap$MapView_check($this, $owner, $from, $fromChecked, $to, $toChecked);
    $this.$owner0 = $owner;
    $this.$from = $from;
    $this.$fromIncluded = $fromIncluded;
    $this.$fromChecked = $fromChecked;
    $this.$to = $to;
    $this.$toIncluded = $toIncluded;
    $this.$toChecked = $toChecked;
    $this.$reverse = $reverse;
    if ($reverse)
        ju_TreeMap_ensureRevertedComparator($owner);
},
ju_TreeMap$MapView__init_0 = (var_0, var_1, var_2, var_3, var_4, var_5, var_6, var_7) => {
    let var_8 = new ju_TreeMap$MapView();
    ju_TreeMap$MapView__init_(var_8, var_0, var_1, var_2, var_3, var_4, var_5, var_6, var_7);
    return var_8;
},
ju_TreeMap$MapView_check = ($this, $owner, $from, $fromChecked, $to, $toChecked) => {
    if (!$fromChecked) {
        if ($toChecked)
            $owner.$comparator.$compare($to, $to);
    } else if (!$toChecked)
        $owner.$comparator.$compare($from, $from);
    else if ($owner.$comparator.$compare($from, $to) > 0)
        $rt_throw(jl_IllegalArgumentException__init_());
},
ju_TreeMap$MapView_firstKey = $this => {
    let $node;
    $node = $this.$reverse ? ju_TreeMap$MapView_lastNode($this) : ju_TreeMap$MapView_firstNode($this);
    if ($node !== null)
        return $node.$getKey();
    $rt_throw(ju_NoSuchElementException__init_());
},
ju_TreeMap$MapView_firstNode = $this => {
    let $node, $cmp;
    $node = !$this.$fromChecked ? ju_TreeMap_firstNode($this.$owner0, 0) : !$this.$fromIncluded ? $this.$owner0.$findNext($this.$from, 0) : $this.$owner0.$findExactOrNext($this.$from, 0);
    a: {
        b: {
            if ($this.$toChecked) {
                $cmp = $this.$owner0.$comparator.$compare($node.$getKey(), $this.$to);
                if (!$this.$toIncluded) {
                    if ($cmp < 0)
                        break b;
                    else
                        break a;
                }
                if ($cmp > 0)
                    break a;
            }
        }
        return $node;
    }
    return null;
},
ju_TreeMap$MapView_lastNode = $this => {
    let $node, $cmp;
    $node = !$this.$toChecked ? ju_TreeMap_firstNode($this.$owner0, 1) : !$this.$toIncluded ? $this.$owner0.$findNext($this.$to, 1) : $this.$owner0.$findExactOrNext($this.$to, 1);
    a: {
        b: {
            if ($this.$fromChecked) {
                $cmp = $this.$owner0.$comparator.$compare($node.$getKey(), $this.$from);
                if (!$this.$fromIncluded) {
                    if ($cmp > 0)
                        break b;
                    else
                        break a;
                }
                if ($cmp < 0)
                    break a;
            }
        }
        return $node;
    }
    return null;
},
ju_TreeMap$MapView_navigableKeySet = $this => {
    if ($this.$cachedNavigableKeySet === null)
        $this.$cachedNavigableKeySet = ju_TreeMap$NavigableKeySet__init_0($this);
    return $this.$cachedNavigableKeySet;
},
jur_UCIBackReferenceSet = $rt_classWithoutFields(jur_CIBackReferenceSet),
jur_UCIBackReferenceSet__init_ = ($this, $groupIndex, $consCounter) => {
    jur_CIBackReferenceSet__init_($this, $groupIndex, $consCounter);
},
jur_UCIBackReferenceSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_UCIBackReferenceSet();
    jur_UCIBackReferenceSet__init_(var_2, var_0, var_1);
    return var_2;
},
jur_UCIBackReferenceSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $group, $i, var$6, var$7;
    $group = $this.$getString($matchResult);
    if ($group !== null && ($stringIndex + $group.$length() | 0) <= $matchResult.$getRightBound()) {
        $i = 0;
        while (true) {
            if ($i >= $group.$length()) {
                $matchResult.$setConsumed($this.$consCounter1, $group.$length());
                return $this.$next3.$matches($stringIndex + $group.$length() | 0, $testString, $matchResult);
            }
            var$6 = jl_Character_toLowerCase(jl_Character_toUpperCase($group.$charAt($i)));
            var$7 = $stringIndex + $i | 0;
            var$7 = jl_Character_toUpperCase($testString.$charAt(var$7));
            if (var$6 != jl_Character_toLowerCase(var$7))
                break;
            $i = $i + 1 | 0;
        }
        return (-1);
    }
    return (-1);
};
function jur_CharClass$13() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$clazz4 = null;
    a.$this$026 = null;
}
let jur_CharClass$13__init_ = ($this, $this$0, var$2) => {
    $this.$this$026 = $this$0;
    $this.$val$clazz4 = var$2;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$13__init_0 = (var_0, var_1) => {
    let var_2 = new jur_CharClass$13();
    jur_CharClass$13__init_(var_2, var_0, var_1);
    return var_2;
},
jur_CharClass$13_contains = ($this, $ch) => {
    return $this.$val$clazz4.$contains0($ch);
};
function jur_CharClass$12() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$clazz5 = null;
    a.$this$036 = null;
}
let jur_CharClass$12__init_ = ($this, $this$0, var$2) => {
    $this.$this$036 = $this$0;
    $this.$val$clazz5 = var$2;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$12__init_0 = (var_0, var_1) => {
    let var_2 = new jur_CharClass$12();
    jur_CharClass$12__init_(var_2, var_0, var_1);
    return var_2;
},
jur_CharClass$12_contains = ($this, $ch) => {
    return $this.$val$clazz5.$contains0($ch) ? 0 : 1;
};
function jur_CharClass$11() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$curAlt4 = 0;
    a.$val$nb2 = null;
    a.$val$clazz8 = null;
    a.$this$017 = null;
}
let jur_CharClass$11__init_ = ($this, $this$0, var$2, var$3, var$4) => {
    $this.$this$017 = $this$0;
    $this.$val$curAlt4 = var$2;
    $this.$val$nb2 = var$3;
    $this.$val$clazz8 = var$4;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$11__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_CharClass$11();
    jur_CharClass$11__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_CharClass$11_contains = ($this, $ch) => {
    return !($this.$val$curAlt4 ^ $this.$val$nb2.$contains0($ch)) && !$this.$val$clazz8.$contains0($ch) ? 0 : 1;
};
function jur_AbstractCharClass$LazyCategory() {
    let a = this; jur_AbstractCharClass$LazyCharClass.call(a);
    a.$category1 = 0;
    a.$mayContainSupplCodepoints1 = 0;
    a.$containsAllSurrogates0 = 0;
}
let jur_AbstractCharClass$LazyCategory__init_0 = ($this, $cat, $mayContainSupplCodepoints) => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
    $this.$mayContainSupplCodepoints1 = $mayContainSupplCodepoints;
    $this.$category1 = $cat;
},
jur_AbstractCharClass$LazyCategory__init_ = (var_0, var_1) => {
    let var_2 = new jur_AbstractCharClass$LazyCategory();
    jur_AbstractCharClass$LazyCategory__init_0(var_2, var_0, var_1);
    return var_2;
},
jur_AbstractCharClass$LazyCategory__init_1 = ($this, $cat, $mayContainSupplCodepoints, $containsAllSurrogates) => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
    $this.$containsAllSurrogates0 = $containsAllSurrogates;
    $this.$mayContainSupplCodepoints1 = $mayContainSupplCodepoints;
    $this.$category1 = $cat;
},
jur_AbstractCharClass$LazyCategory__init_2 = (var_0, var_1, var_2) => {
    let var_3 = new jur_AbstractCharClass$LazyCategory();
    jur_AbstractCharClass$LazyCategory__init_1(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_AbstractCharClass$LazyCategory_computeValue = $this => {
    let $chCl;
    $chCl = jur_UnicodeCategory__init_0($this.$category1);
    if ($this.$containsAllSurrogates0)
        $chCl.$lowHighSurrogates.$set(0, 2048);
    $chCl.$mayContainSupplCodepoints0 = $this.$mayContainSupplCodepoints1;
    return $chCl;
},
otci_Base46 = $rt_classWithoutFields(),
otci_Base46_decodeUnsigned = $seq => {
    let $number, $pos, var$4, var$5, $digit, $hasMore;
    $number = 0;
    $pos = 1;
    while (true) {
        var$4 = $seq.$characters.data;
        var$5 = $seq.$pointer;
        $seq.$pointer = var$5 + 1 | 0;
        $digit = otci_Base46_decodeDigit(var$4[var$5]);
        $hasMore = ($digit % 2 | 0) != 1 ? 0 : 1;
        $number = $number + $rt_imul($pos, $digit / 2 | 0) | 0;
        $pos = $pos * 46 | 0;
        if (!$hasMore)
            break;
    }
    return $number;
},
otci_Base46_decode = $seq => {
    let $number, $result;
    $number = otci_Base46_decodeUnsigned($seq);
    $result = $number / 2 | 0;
    if ($number % 2 | 0)
        $result =  -$result | 0;
    return $result;
},
otci_Base46_decodeDigit = $c => {
    if ($c < 34)
        return $c - 32 | 0;
    if ($c >= 92)
        return ($c - 32 | 0) - 2 | 0;
    return ($c - 32 | 0) - 1 | 0;
};
function jur_CharClass$10() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$curAlt6 = 0;
    a.$val$nb0 = null;
    a.$val$clazz0 = null;
    a.$this$024 = null;
}
let jur_CharClass$10__init_ = ($this, $this$0, var$2, var$3, var$4) => {
    $this.$this$024 = $this$0;
    $this.$val$curAlt6 = var$2;
    $this.$val$nb0 = var$3;
    $this.$val$clazz0 = var$4;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$10__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_CharClass$10();
    jur_CharClass$10__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_CharClass$10_contains = ($this, $ch) => {
    return !($this.$val$curAlt6 ^ $this.$val$nb0.$contains0($ch)) && !$this.$val$clazz0.$contains0($ch) ? 1 : 0;
};
function jur_CharClass$17() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$curAlt5 = 0;
    a.$val$nb1 = null;
    a.$val$clazz10 = null;
    a.$this$021 = null;
}
let jur_CharClass$17__init_ = ($this, $this$0, var$2, var$3, var$4) => {
    $this.$this$021 = $this$0;
    $this.$val$curAlt5 = var$2;
    $this.$val$nb1 = var$3;
    $this.$val$clazz10 = var$4;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$17__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_CharClass$17();
    jur_CharClass$17__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_CharClass$17_contains = ($this, $ch) => {
    return $this.$val$curAlt5 ^ $this.$val$nb1.$contains0($ch) && $this.$val$clazz10.$contains0($ch) ? 1 : 0;
};
function jur_UCISequenceSet() {
    jur_LeafSet.call(this);
    this.$string2 = null;
}
let jur_UCISequenceSet__init_ = ($this, $substring) => {
    let $res, $i;
    jur_LeafSet__init_($this);
    $res = jl_StringBuilder__init_();
    $i = 0;
    while ($i < $substring.$length()) {
        $res.$append0(jl_Character_toLowerCase(jl_Character_toUpperCase($substring.$charAt($i))));
        $i = $i + 1 | 0;
    }
    $this.$string2 = $res.$toString();
    $this.$charCount0 = $res.$length();
},
jur_UCISequenceSet__init_0 = var_0 => {
    let var_1 = new jur_UCISequenceSet();
    jur_UCISequenceSet__init_(var_1, var_0);
    return var_1;
},
jur_UCISequenceSet_accepts = ($this, $strIndex, $testString) => {
    let $i;
    $i = 0;
    while (true) {
        if ($i >= $this.$string2.$length())
            return $this.$string2.$length();
        if ($this.$string2.$charAt($i) != jl_Character_toLowerCase(jl_Character_toUpperCase($testString.$charAt($strIndex + $i | 0))))
            break;
        $i = $i + 1 | 0;
    }
    return (-1);
};
function jur_CharClass$16() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$curAlt3 = 0;
    a.$val$nb = null;
    a.$val$clazz3 = null;
    a.$this$028 = null;
}
let jur_CharClass$16__init_ = ($this, $this$0, var$2, var$3, var$4) => {
    $this.$this$028 = $this$0;
    $this.$val$curAlt3 = var$2;
    $this.$val$nb = var$3;
    $this.$val$clazz3 = var$4;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$16__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_CharClass$16();
    jur_CharClass$16__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_CharClass$16_contains = ($this, $ch) => {
    return $this.$val$curAlt3 ^ $this.$val$nb.$contains0($ch) && $this.$val$clazz3.$contains0($ch) ? 0 : 1;
},
owtp_TwoByTwoSolver = $rt_classWithoutFields(),
owtp_TwoByTwoSolver_moveToString = null,
owtp_TwoByTwoSolver_inverseMoveToString = null,
owtp_TwoByTwoSolver_fact = null,
owtp_TwoByTwoSolver_movePerm = null,
owtp_TwoByTwoSolver_moveOrient = null,
owtp_TwoByTwoSolver_prunPerm = null,
owtp_TwoByTwoSolver_prunOrient = null,
owtp_TwoByTwoSolver_$assertionsDisabled = 0,
owtp_TwoByTwoSolver_$callClinit = () => {
    owtp_TwoByTwoSolver_$callClinit = $rt_eraseClinit(owtp_TwoByTwoSolver);
    owtp_TwoByTwoSolver__clinit_();
},
owtp_TwoByTwoSolver__init_ = $this => {
    owtp_TwoByTwoSolver_$callClinit();
    jl_Object__init_($this);
},
owtp_TwoByTwoSolver__init_0 = () => {
    let var_0 = new owtp_TwoByTwoSolver();
    owtp_TwoByTwoSolver__init_(var_0);
    return var_0;
},
owtp_TwoByTwoSolver_packPerm = $cubies => {
    let $idx, $val, $i, $v;
    owtp_TwoByTwoSolver_$callClinit();
    $idx = 0;
    $val = 106181136;
    $i = 0;
    while ($i < 6) {
        $v = ($cubies.data[$i] & 7) << 2;
        $idx = $rt_imul(7 - $i | 0, $idx) + ($val >> $v & 7) | 0;
        $val = $val - (17895696 << $v) | 0;
        $i = $i + 1 | 0;
    }
    return $idx;
},
owtp_TwoByTwoSolver_unpackPerm = ($perm, $cubies) => {
    let $val, $i, var$5, $p, $v, var$8, $m;
    owtp_TwoByTwoSolver_$callClinit();
    $val = 106181136;
    $i = 0;
    while ($i < 6) {
        var$5 = $cubies.data;
        $p = owtp_TwoByTwoSolver_fact.data[6 - $i | 0];
        $v = $perm / $p | 0;
        $perm = $perm - $rt_imul($v, $p) | 0;
        var$8 = $v << 2;
        var$5[$i] = $val >> var$8 & 7;
        $m = (1 << var$8) - 1 | 0;
        $val = ($val & $m) + ($val >> 4 & ($m ^ (-1))) | 0;
        $i = $i + 1 | 0;
    }
    $cubies.data[6] = $val;
},
owtp_TwoByTwoSolver_packOrient = $cubies => {
    let $ori, $i, var$4;
    owtp_TwoByTwoSolver_$callClinit();
    $ori = 0;
    $i = 0;
    while ($i < 6) {
        var$4 = $cubies.data;
        $ori = (3 * $ori | 0) + (var$4[$i] >> 3) | 0;
        $i = $i + 1 | 0;
    }
    return $ori;
},
owtp_TwoByTwoSolver_unpackOrient = ($ori, $cubies) => {
    let $sum_ori, $i, var$5, var$6;
    owtp_TwoByTwoSolver_$callClinit();
    $sum_ori = 0;
    $i = 5;
    while ($i >= 0) {
        var$5 = $cubies.data;
        var$6 = $ori % 3 | 0;
        var$5[$i] = var$6 << 3;
        $sum_ori = $sum_ori + var$6 | 0;
        $ori = $ori / 3 | 0;
        $i = $i + (-1) | 0;
    }
    $cubies.data[6] = ((42424242 - $sum_ori | 0) % 3 | 0) << 3;
},
owtp_TwoByTwoSolver_cycle = ($cubies, $a, $b, $c, $d, $times) => {
    let var$7, $temp;
    owtp_TwoByTwoSolver_$callClinit();
    var$7 = $cubies.data;
    $temp = var$7[$d];
    var$7[$d] = var$7[$c];
    var$7[$c] = var$7[$b];
    var$7[$b] = var$7[$a];
    var$7[$a] = $temp;
    if ($times > 1)
        owtp_TwoByTwoSolver_cycle($cubies, $a, $b, $c, $d, $times - 1 | 0);
},
owtp_TwoByTwoSolver_cycleAndOrient = ($cubies, $a, $b, $c, $d, $times) => {
    let var$7, $temp;
    owtp_TwoByTwoSolver_$callClinit();
    var$7 = $cubies.data;
    $temp = var$7[$d];
    var$7[$d] = (var$7[$c] + 8 | 0) % 24 | 0;
    var$7[$c] = (var$7[$b] + 16 | 0) % 24 | 0;
    var$7[$b] = (var$7[$a] + 8 | 0) % 24 | 0;
    var$7[$a] = ($temp + 16 | 0) % 24 | 0;
    if ($times > 1)
        owtp_TwoByTwoSolver_cycleAndOrient($cubies, $a, $b, $c, $d, $times - 1 | 0);
},
owtp_TwoByTwoSolver_moveCubies = ($cubies, $move) => {
    let $face, $times;
    owtp_TwoByTwoSolver_$callClinit();
    a: {
        b: {
            $face = $move / 3 | 0;
            $times = ($move % 3 | 0) + 1 | 0;
            switch ($face) {
                case 0:
                    break b;
                case 1:
                    owtp_TwoByTwoSolver_cycleAndOrient($cubies, 0, 2, 6, 4, $times);
                    break a;
                case 2:
                    owtp_TwoByTwoSolver_cycleAndOrient($cubies, 1, 0, 4, 5, $times);
                    break a;
                default:
            }
            if (owtp_TwoByTwoSolver_$assertionsDisabled)
                break a;
            $rt_throw(jl_AssertionError__init_());
        }
        owtp_TwoByTwoSolver_cycle($cubies, 1, 3, 2, 0, $times);
    }
},
owtp_TwoByTwoSolver_initMoves = () => {
    let $cubies1, $cubies2, $perm, $move, $newPerm, $orient, $newOrient;
    owtp_TwoByTwoSolver_$callClinit();
    $cubies1 = $rt_createIntArray(7);
    $cubies2 = $rt_createIntArray(7);
    $perm = 0;
    while ($perm < 5040) {
        owtp_TwoByTwoSolver_unpackPerm($perm, $cubies1);
        $move = 0;
        while ($move < 9) {
            jl_System_fastArraycopy($cubies1, 0, $cubies2, 0, 7);
            owtp_TwoByTwoSolver_moveCubies($cubies2, $move);
            $newPerm = owtp_TwoByTwoSolver_packPerm($cubies2);
            owtp_TwoByTwoSolver_movePerm.data[$perm].data[$move] = $newPerm;
            $move = $move + 1 | 0;
        }
        $perm = $perm + 1 | 0;
    }
    $orient = 0;
    while ($orient < 729) {
        owtp_TwoByTwoSolver_unpackOrient($orient, $cubies1);
        $move = 0;
        while ($move < 9) {
            jl_System_fastArraycopy($cubies1, 0, $cubies2, 0, 7);
            owtp_TwoByTwoSolver_moveCubies($cubies2, $move);
            $newOrient = owtp_TwoByTwoSolver_packOrient($cubies2);
            owtp_TwoByTwoSolver_moveOrient.data[$orient].data[$move] = $newOrient;
            $move = $move + 1 | 0;
        }
        $orient = $orient + 1 | 0;
    }
},
owtp_TwoByTwoSolver_initPrun = () => {
    let $perm, $done, $length, $move, $newPerm, $orient, var$7, $newOrient;
    owtp_TwoByTwoSolver_$callClinit();
    $perm = 0;
    while ($perm < 5040) {
        owtp_TwoByTwoSolver_prunPerm.data[$perm] = (-1);
        $perm = $perm + 1 | 0;
    }
    owtp_TwoByTwoSolver_prunPerm.data[0] = 0;
    $done = 1;
    $length = 0;
    while ($done < 5040) {
        $perm = 0;
        while ($perm < 5040) {
            if (owtp_TwoByTwoSolver_prunPerm.data[$perm] == $length) {
                $move = 0;
                while ($move < 9) {
                    $newPerm = owtp_TwoByTwoSolver_movePerm.data[$perm].data[$move];
                    if (owtp_TwoByTwoSolver_prunPerm.data[$newPerm] == (-1)) {
                        owtp_TwoByTwoSolver_prunPerm.data[$newPerm] = $length + 1 | 0;
                        $done = $done + 1 | 0;
                    }
                    $move = $move + 1 | 0;
                }
            }
            $perm = $perm + 1 | 0;
        }
        $length = $length + 1 | 0;
    }
    $orient = 0;
    while ($orient < 729) {
        owtp_TwoByTwoSolver_prunOrient.data[$orient] = (-1);
        $orient = $orient + 1 | 0;
    }
    owtp_TwoByTwoSolver_prunOrient.data[0] = 0;
    var$7 = 1;
    $length = 0;
    while (var$7 < 729) {
        $orient = 0;
        while ($orient < 729) {
            if (owtp_TwoByTwoSolver_prunOrient.data[$orient] == $length) {
                $move = 0;
                while ($move < 9) {
                    $newOrient = owtp_TwoByTwoSolver_moveOrient.data[$orient].data[$move];
                    if (owtp_TwoByTwoSolver_prunOrient.data[$newOrient] == (-1)) {
                        owtp_TwoByTwoSolver_prunOrient.data[$newOrient] = $length + 1 | 0;
                        var$7 = var$7 + 1 | 0;
                    }
                    $move = $move + 1 | 0;
                }
            }
            $orient = $orient + 1 | 0;
        }
        $length = $length + 1 | 0;
    }
},
owtp_TwoByTwoSolver_search = ($this, $perm, $orient, $depth, $length, $last_move, $solution, $best_solution) => {
    let var$8, $cost, $solutionFound, $move, var$12, $newPerm, $newOrient;
    if (!$length) {
        if (!$perm && !$orient) {
            var$8 = $best_solution.data;
            $cost = owtp_TwoByTwoSolver_computeCost($this, $solution, $depth, 0, 0);
            if ($cost < var$8[$depth]) {
                jl_System_fastArraycopy($solution, 0, $best_solution, 0, $depth);
                var$8[$depth] = $cost;
            }
            return 1;
        }
        return 0;
    }
    owtp_TwoByTwoSolver_$callClinit();
    if (owtp_TwoByTwoSolver_prunPerm.data[$perm] <= $length && owtp_TwoByTwoSolver_prunOrient.data[$orient] <= $length) {
        $solutionFound = 0;
        $move = 0;
        while ($move < 9) {
            if (($move / 3 | 0) != ($last_move / 3 | 0)) {
                var$12 = $solution.data;
                $newPerm = owtp_TwoByTwoSolver_movePerm.data[$perm].data[$move];
                $newOrient = owtp_TwoByTwoSolver_moveOrient.data[$orient].data[$move];
                var$12[$depth] = $move;
                $solutionFound = $solutionFound | owtp_TwoByTwoSolver_search($this, $newPerm, $newOrient, $depth + 1 | 0, $length - 1 | 0, $move, $solution, $best_solution);
            }
            $move = $move + 1 | 0;
        }
        return $solutionFound;
    }
    return 0;
},
owtp_TwoByTwoSolver_randomState = ($this, $r) => {
    let $state;
    $state = owtp_TwoByTwoSolver$TwoByTwoState__init_0();
    $state.$permutation = $r.$nextInt(5040);
    $state.$orientation = $r.$nextInt(729);
    return $state;
},
owtp_TwoByTwoSolver_solveIn = ($this, $state, $length) => {
    return owtp_TwoByTwoSolver_solve($this, $state, $length, 0, 0);
},
owtp_TwoByTwoSolver_generateExactly = ($this, $state, $length) => {
    return owtp_TwoByTwoSolver_solve($this, $state, $length, 1, 1);
},
owtp_TwoByTwoSolver_solve = ($this, $state, $desiredLength, $exactLength, $inverse) => {
    let $solution, $best_solution, $foundSolution, $length, $scramble, var$10, $l, var$12;
    $solution = $rt_createIntArray(20);
    $best_solution = $rt_createIntArray(21);
    $foundSolution = 0;
    $length = !$exactLength ? 0 : $desiredLength;
    a: {
        while ($length <= $desiredLength) {
            $best_solution.data[$length] = 42424242;
            if (owtp_TwoByTwoSolver_search($this, $state.$permutation, $state.$orientation, 0, $length, 42, $solution, $best_solution)) {
                $foundSolution = 1;
                break a;
            }
            $length = $length + 1 | 0;
        }
    }
    if (!$foundSolution)
        return null;
    if (!$length)
        return $rt_s(3);
    b: {
        $scramble = jl_StringBuilder__init_0(60);
        if (!$inverse) {
            var$10 = $best_solution.data;
            owtp_TwoByTwoSolver_$callClinit();
            $scramble.$append1(owtp_TwoByTwoSolver_moveToString.data[var$10[0]]);
            $l = 1;
            while (true) {
                if ($l >= $length)
                    break b;
                ($scramble.$append1($rt_s(16))).$append1(owtp_TwoByTwoSolver_moveToString.data[var$10[$l]]);
                $l = $l + 1 | 0;
            }
        }
        var$12 = $best_solution.data;
        owtp_TwoByTwoSolver_$callClinit();
        $scramble.$append1(owtp_TwoByTwoSolver_inverseMoveToString.data[var$12[$length - 1 | 0]]);
        $l = $length - 2 | 0;
        while ($l >= 0) {
            ($scramble.$append1($rt_s(16))).$append1(owtp_TwoByTwoSolver_inverseMoveToString.data[var$12[$l]]);
            $l = $l + (-1) | 0;
        }
    }
    return $scramble.$toString();
},
owtp_TwoByTwoSolver_computeCost = ($this, $solution, $index, $current_cost, $grip) => {
    let var$5, var$6, var$7;
    if ($index < 0)
        return $current_cost;
    switch ($solution.data[$index]) {
        case 0:
            break;
        case 1:
            return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 10 | 0, $grip);
        case 2:
            if (!$grip)
                return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 8 | 0, 0);
            if ($grip != (-1))
                return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, ($current_cost + 20 | 0) + 8 | 0, 0);
            var$5 = $index - 1 | 0;
            var$6 = $current_cost + 20 | 0;
            var$7 = owtp_TwoByTwoSolver_computeCost($this, $solution, var$5, var$6 + 8 | 0, 0);
            var$5 = owtp_TwoByTwoSolver_computeCost($this, $solution, var$5, var$6, $grip);
            return jl_Math_min(var$7, var$5);
        case 3:
            if ($grip > (-1))
                return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 6 | 0, $grip - 1 | 0);
            return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, ($current_cost + 20 | 0) + 6 | 0, (-1));
        case 4:
            if ($grip)
                return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 10 | 0,  -$grip | 0);
            var$5 = $index - 1 | 0;
            var$6 = ($current_cost + 20 | 0) + 10 | 0;
            var$7 = owtp_TwoByTwoSolver_computeCost($this, $solution, var$5, var$6, (-1));
            var$5 = owtp_TwoByTwoSolver_computeCost($this, $solution, var$5, var$6, 1);
            return jl_Math_min(var$7, var$5);
        case 5:
            if ($grip < 1)
                return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 6 | 0, $grip + 1 | 0);
            return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, ($current_cost + 20 | 0) + 6 | 0, 1);
        case 6:
            if ($grip)
                return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 19 | 0, $grip);
            var$5 = $index - 1 | 0;
            var$6 = ($current_cost + 20 | 0) + 19 | 0;
            var$7 = owtp_TwoByTwoSolver_computeCost($this, $solution, var$5, var$6, (-1));
            var$5 = owtp_TwoByTwoSolver_computeCost($this, $solution, var$5, var$6, 1);
            return jl_Math_min(var$7, var$5);
        case 7:
            if ($grip == (-1))
                return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 30 | 0, (-1));
            return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, ($current_cost + 20 | 0) + 30 | 0, (-1));
        case 8:
            if ($grip == (-1))
                return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 10 | 0, (-1));
            return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, ($current_cost + 20 | 0) + 10 | 0, (-1));
        default:
            owtp_TwoByTwoSolver_$callClinit();
            if (owtp_TwoByTwoSolver_$assertionsDisabled)
                return (-1);
            $rt_throw(jl_AssertionError__init_());
    }
    return owtp_TwoByTwoSolver_computeCost($this, $solution, $index - 1 | 0, $current_cost + 7 | 0, $grip);
},
owtp_TwoByTwoSolver__clinit_ = () => {
    owtp_TwoByTwoSolver_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_TwoByTwoSolver)) ? 0 : 1;
    owtp_TwoByTwoSolver_moveToString = $rt_wrapArray(jl_String, [$rt_s(17), $rt_s(18), $rt_s(19), $rt_s(20), $rt_s(21), $rt_s(22), $rt_s(23), $rt_s(24), $rt_s(25)]);
    owtp_TwoByTwoSolver_inverseMoveToString = $rt_wrapArray(jl_String, [$rt_s(19), $rt_s(18), $rt_s(17), $rt_s(22), $rt_s(21), $rt_s(20), $rt_s(25), $rt_s(24), $rt_s(23)]);
    owtp_TwoByTwoSolver_fact = $rt_createIntArrayFromData([1, 1, 2, 6, 24, 120, 720]);
    owtp_TwoByTwoSolver_movePerm = $rt_createIntMultiArray([9, 5040]);
    owtp_TwoByTwoSolver_moveOrient = $rt_createIntMultiArray([9, 729]);
    owtp_TwoByTwoSolver_prunPerm = $rt_createIntArray(5040);
    owtp_TwoByTwoSolver_prunOrient = $rt_createIntArray(729);
    owtp_TwoByTwoSolver_initMoves();
    owtp_TwoByTwoSolver_initPrun();
},
jur_DotAllQuantifierSet = $rt_classWithoutFields(jur_QuantifierSet),
jur_DotAllQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_QuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_DotAllQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_DotAllQuantifierSet();
    jur_DotAllQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_DotAllQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength;
    $strLength = $matchResult.$getRightBound();
    if ($strLength > $stringIndex)
        return $this.$next3.$findBack($stringIndex, $strLength, $testString, $matchResult);
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_DotAllQuantifierSet_find = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength;
    $strLength = $matchResult.$getRightBound();
    if ($this.$next3.$findBack($stringIndex, $strLength, $testString, $matchResult) >= 0)
        return $stringIndex;
    return (-1);
};
function jur_CharClass$15() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$clazz9 = null;
    a.$val$curAlt1 = 0;
    a.$this$011 = null;
}
let jur_CharClass$15__init_ = ($this, $this$0, var$2, var$3) => {
    $this.$this$011 = $this$0;
    $this.$val$clazz9 = var$2;
    $this.$val$curAlt1 = var$3;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$15__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_CharClass$15();
    jur_CharClass$15__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_CharClass$15_contains = ($this, $ch) => {
    return $this.$val$clazz9.$contains0($ch) && $this.$val$curAlt1 ^ $this.$this$011.$bits.$get1($ch) ? 1 : 0;
};
function jur_AbstractCharClass$LazyJavaDefined$1() {
    jur_AbstractCharClass.call(this);
    this.$this$030 = null;
}
let jur_AbstractCharClass$LazyJavaDefined$1__init_ = ($this, $this$0) => {
    $this.$this$030 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaDefined$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaDefined$1();
    jur_AbstractCharClass$LazyJavaDefined$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaDefined$1_contains = ($this, $ch) => {
    return jl_Character_isDefined($ch);
};
function jur_CharClass$14() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$clazz2 = null;
    a.$val$curAlt10 = 0;
    a.$this$06 = null;
}
let jur_CharClass$14__init_ = ($this, $this$0, var$2, var$3) => {
    $this.$this$06 = $this$0;
    $this.$val$clazz2 = var$2;
    $this.$val$curAlt10 = var$3;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$14__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_CharClass$14();
    jur_CharClass$14__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_CharClass$14_contains = ($this, $ch) => {
    return $this.$val$clazz2.$contains0($ch) && $this.$val$curAlt10 ^ $this.$this$06.$bits.$get1($ch) ? 0 : 1;
},
jl_String$_clinit_$lambda$_118_0 = $rt_classWithoutFields(),
jl_String$_clinit_$lambda$_118_0__init_ = var$0 => {
    jl_Object__init_(var$0);
},
jl_String$_clinit_$lambda$_118_0__init_0 = () => {
    let var_0 = new jl_String$_clinit_$lambda$_118_0();
    jl_String$_clinit_$lambda$_118_0__init_(var_0);
    return var_0;
};
function jur_FSet() {
    let a = this; jur_AbstractSet.call(a);
    a.$isBackReferenced = 0;
    a.$groupIndex0 = 0;
}
let jur_FSet_posFSet = null,
jur_FSet_$callClinit = () => {
    jur_FSet_$callClinit = $rt_eraseClinit(jur_FSet);
    jur_FSet__clinit_();
},
jur_FSet__init_ = ($this, $groupIndex) => {
    jur_FSet_$callClinit();
    jur_AbstractSet__init_($this);
    $this.$groupIndex0 = $groupIndex;
},
jur_FSet__init_0 = var_0 => {
    let var_1 = new jur_FSet();
    jur_FSet__init_(var_1, var_0);
    return var_1;
},
jur_FSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $end, $shift;
    $end = $matchResult.$getEnd($this.$groupIndex0);
    $matchResult.$setEnd($this.$groupIndex0, $stringIndex);
    $shift = $this.$next3.$matches($stringIndex, $testString, $matchResult);
    if ($shift < 0)
        $matchResult.$setEnd($this.$groupIndex0, $end);
    return $shift;
},
jur_FSet_getGroupIndex = $this => {
    return $this.$groupIndex0;
},
jur_FSet_hasConsumed = ($this, $mr) => {
    return 0;
},
jur_FSet__clinit_ = () => {
    jur_FSet_posFSet = jur_FSet$PossessiveFSet__init_0();
},
jur_BehindFSet = $rt_classWithoutFields(jur_FSet),
jur_BehindFSet__init_ = ($this, $groupIndex) => {
    jur_FSet__init_($this, $groupIndex);
},
jur_BehindFSet__init_0 = var_0 => {
    let var_1 = new jur_BehindFSet();
    jur_BehindFSet__init_(var_1, var_0);
    return var_1;
},
jur_BehindFSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $gr, $rightBound;
    $gr = $this.$getGroupIndex();
    $rightBound = $matchResult.$getConsumed($gr);
    if ($rightBound != $stringIndex)
        $stringIndex = (-1);
    return $stringIndex;
},
jlr_Reference = $rt_classWithoutFields();
function jlr_WeakReference() {
    jlr_Reference.call(this);
    this.$value3 = null;
}
let jlr_WeakReference__init_ = (var$0, var$1, var$2) => {
    let supported = typeof WeakRef !== 'undefined';
    let value = supported && var$1 !== null ? new WeakRef(var$1) : var$1;
    var$0.$value3 = value;
    if (var$2 !== null && supported && var$1 !== null) {
        let registry = var$2.$registry;
        if (registry !== null) {
            registry.register(var$1, var$0);
        }
    }
},
jlr_WeakReference__init_0 = (var_0, var_1) => {
    let var_2 = new jlr_WeakReference();
    jlr_WeakReference__init_(var_2, var_0, var_1);
    return var_2;
},
jlr_WeakReference_get = var$0 => {
    let value = var$0.$value3;
    if (typeof WeakRef !== 'undefined') {
        if (value === null) {
            return null;
        }
        let result = value.deref();
        return typeof result !== 'undefined' ? result : null;
    }
    return value;
},
ju_Map$Entry = $rt_classWithoutFields(0);
function ju_WeakHashMap$Entry() {
    let a = this; jlr_WeakReference.call(a);
    a.$hash = 0;
    a.$isNull = 0;
    a.$value0 = null;
    a.$next5 = null;
}
let ju_WeakHashMap$Entry__init_ = (var$0, var$1, var$2, $queue) => {
    jlr_WeakReference__init_(var$0, var$1, $queue);
    var$0.$isNull = var$1 !== null ? 0 : 1;
    var$0.$hash = !var$0.$isNull ? var$1.$hashCode() : 0;
    var$0.$value0 = var$2;
},
ju_WeakHashMap$Entry__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new ju_WeakHashMap$Entry();
    ju_WeakHashMap$Entry__init_(var_3, var_0, var_1, var_2);
    return var_3;
};
function jl_AbstractStringBuilder() {
    let a = this; jl_Object.call(a);
    a.$buffer = null;
    a.$length1 = 0;
}
let jl_AbstractStringBuilder__init_0 = $this => {
    jl_AbstractStringBuilder__init_($this, 16);
},
jl_AbstractStringBuilder__init_2 = () => {
    let var_0 = new jl_AbstractStringBuilder();
    jl_AbstractStringBuilder__init_0(var_0);
    return var_0;
},
jl_AbstractStringBuilder__init_ = ($this, $capacity) => {
    jl_Object__init_($this);
    $this.$buffer = $rt_createCharArray($capacity);
},
jl_AbstractStringBuilder__init_1 = var_0 => {
    let var_1 = new jl_AbstractStringBuilder();
    jl_AbstractStringBuilder__init_(var_1, var_0);
    return var_1;
},
jl_AbstractStringBuilder_append5 = ($this, $obj) => {
    return $this.$insert($this.$length1, $obj);
},
jl_AbstractStringBuilder_append = ($this, $string) => {
    return $this.$insert0($this.$length1, $string);
},
jl_AbstractStringBuilder_insert0 = ($this, $index, $string) => {
    let $i, var$4, var$5;
    if ($index >= 0 && $index <= $this.$length1) {
        if ($string === null)
            $string = $rt_s(26);
        else if ($string.$isEmpty())
            return $this;
        $this.$ensureCapacity($this.$length1 + $string.$length() | 0);
        $i = $this.$length1 - 1 | 0;
        while ($i >= $index) {
            $this.$buffer.data[$i + $string.$length() | 0] = $this.$buffer.data[$i];
            $i = $i + (-1) | 0;
        }
        $this.$length1 = $this.$length1 + $string.$length() | 0;
        $i = 0;
        while ($i < $string.$length()) {
            var$4 = $this.$buffer.data;
            var$5 = $index + 1 | 0;
            var$4[$index] = $string.$charAt($i);
            $i = $i + 1 | 0;
            $index = var$5;
        }
        return $this;
    }
    $rt_throw(jl_StringIndexOutOfBoundsException__init_());
},
jl_AbstractStringBuilder_append1 = ($this, $value) => {
    return $this.$append2($value, 10);
},
jl_AbstractStringBuilder_append7 = ($this, $value, $radix) => {
    return $this.$insert1($this.$length1, $value, $radix);
},
jl_AbstractStringBuilder_insert4 = ($this, $target, $value, $radix) => {
    let $positive, var$5, var$6, $pos, $sz, $posLimit, var$10, var$11;
    $positive = 1;
    if ($value < 0) {
        $positive = 0;
        $value =  -$value | 0;
    }
    a: {
        if ($rt_ucmp($value, $radix) < 0) {
            if ($positive)
                jl_AbstractStringBuilder_insertSpace($this, $target, $target + 1 | 0);
            else {
                jl_AbstractStringBuilder_insertSpace($this, $target, $target + 2 | 0);
                var$5 = $this.$buffer.data;
                var$6 = $target + 1 | 0;
                var$5[$target] = 45;
                $target = var$6;
            }
            $this.$buffer.data[$target] = jl_Character_forDigit($value, $radix);
        } else {
            $pos = 1;
            $sz = 1;
            $posLimit = $rt_udiv((-1), $radix);
            b: {
                while (true) {
                    var$10 = $rt_imul($pos, $radix);
                    if ($rt_ucmp(var$10, $value) > 0) {
                        var$10 = $pos;
                        break b;
                    }
                    $sz = $sz + 1 | 0;
                    if ($rt_ucmp(var$10, $posLimit) > 0)
                        break;
                    $pos = var$10;
                }
            }
            if (!$positive)
                $sz = $sz + 1 | 0;
            jl_AbstractStringBuilder_insertSpace($this, $target, $target + $sz | 0);
            if ($positive)
                var$11 = $target;
            else {
                var$5 = $this.$buffer.data;
                var$11 = $target + 1 | 0;
                var$5[$target] = 45;
            }
            while (true) {
                if (!var$10)
                    break a;
                var$5 = $this.$buffer.data;
                var$6 = var$11 + 1 | 0;
                var$5[var$11] = jl_Character_forDigit($rt_udiv($value, var$10), $radix);
                $value = $rt_umod($value, var$10);
                var$10 = $rt_udiv(var$10, $radix);
                var$11 = var$6;
            }
        }
    }
    return $this;
},
jl_AbstractStringBuilder_append3 = ($this, $c) => {
    return $this.$insert2($this.$length1, $c);
},
jl_AbstractStringBuilder_insert1 = ($this, $index, $c) => {
    jl_AbstractStringBuilder_insertSpace($this, $index, $index + 1 | 0);
    $this.$buffer.data[$index] = $c;
    return $this;
},
jl_AbstractStringBuilder_insert3 = ($this, $index, $obj) => {
    return $this.$insert0($index, $obj === null ? $rt_s(26) : $obj.$toString());
},
jl_AbstractStringBuilder_ensureCapacity = ($this, $capacity) => {
    let $newLength;
    if ($this.$buffer.data.length >= $capacity)
        return;
    $newLength = $this.$buffer.data.length >= 1073741823 ? 2147483647 : jl_Math_max($capacity, jl_Math_max($this.$buffer.data.length * 2 | 0, 5));
    $this.$buffer = ju_Arrays_copyOf1($this.$buffer, $newLength);
},
jl_AbstractStringBuilder_toString = $this => {
    return jl_String__init_1($this.$buffer, 0, $this.$length1);
},
jl_AbstractStringBuilder_length = $this => {
    return $this.$length1;
},
jl_AbstractStringBuilder_charAt = ($this, $index) => {
    if ($index >= 0 && $index < $this.$length1)
        return $this.$buffer.data[$index];
    $rt_throw(jl_IndexOutOfBoundsException__init_());
},
jl_AbstractStringBuilder_append4 = ($this, $s, $start, $end) => {
    return $this.$insert3($this.$length1, $s, $start, $end);
},
jl_AbstractStringBuilder_insert2 = ($this, $index, $s, $i, $end) => {
    let var$5, var$6;
    if ($i <= $end && $end <= $s.$length() && $i >= 0) {
        jl_AbstractStringBuilder_insertSpace($this, $index, ($index + $end | 0) - $i | 0);
        while ($i < $end) {
            var$5 = $this.$buffer.data;
            var$6 = $index + 1 | 0;
            var$5[$index] = $s.$charAt($i);
            $i = $i + 1 | 0;
            $index = var$6;
        }
        return $this;
    }
    $rt_throw(jl_IndexOutOfBoundsException__init_());
},
jl_AbstractStringBuilder_append6 = ($this, $s) => {
    return $this.$append5($s, 0, $s.$length());
},
jl_AbstractStringBuilder_append2 = ($this, $chars, $offset, $len) => {
    return $this.$insert4($this.$length1, $chars, $offset, $len);
},
jl_AbstractStringBuilder_insert = ($this, $index, $chars, $offset, $len) => {
    let var$5, var$6, var$7, var$8, var$9;
    jl_AbstractStringBuilder_insertSpace($this, $index, $index + $len | 0);
    var$5 = $len + $offset | 0;
    while ($offset < var$5) {
        var$6 = $chars.data;
        var$7 = $this.$buffer.data;
        var$8 = $index + 1 | 0;
        var$9 = $offset + 1 | 0;
        var$7[$index] = var$6[$offset];
        $index = var$8;
        $offset = var$9;
    }
    return $this;
},
jl_AbstractStringBuilder_append0 = ($this, $chars) => {
    return $this.$append6($chars, 0, $chars.data.length);
},
jl_AbstractStringBuilder_deleteCharAt = ($this, $i) => {
    let var$2, var$3, $i_0;
    if ($i >= 0 && $i < $this.$length1) {
        $this.$length1 = $this.$length1 - 1 | 0;
        while ($i < $this.$length1) {
            var$2 = $this.$buffer.data;
            var$3 = $this.$buffer.data;
            $i_0 = $i + 1 | 0;
            var$2[$i] = var$3[$i_0];
            $i = $i_0;
        }
        return $this;
    }
    $rt_throw(jl_StringIndexOutOfBoundsException__init_());
},
jl_AbstractStringBuilder_delete = ($this, $start, $end) => {
    let var$3, $sz, $i, var$6, var$7, var$8;
    if ($start >= 0) {
        var$3 = $rt_compare($start, $end);
        if (var$3 <= 0 && $start <= $this.$length1) {
            if (!var$3)
                return $this;
            if ($end > $this.$length1)
                $end = $this.$length1;
            $sz = $this.$length1 - $end | 0;
            $this.$length1 = $this.$length1 - ($end - $start | 0) | 0;
            $i = 0;
            while ($i < $sz) {
                var$6 = $this.$buffer.data;
                var$3 = $start + 1 | 0;
                var$7 = $this.$buffer.data;
                var$8 = $end + 1 | 0;
                var$6[$start] = var$7[$end];
                $i = $i + 1 | 0;
                $start = var$3;
                $end = var$8;
            }
            return $this;
        }
    }
    $rt_throw(jl_StringIndexOutOfBoundsException__init_());
},
jl_AbstractStringBuilder_insertSpace = ($this, $start, $end) => {
    let $sz, $i;
    $sz = $this.$length1 - $start | 0;
    $this.$ensureCapacity(($this.$length1 + $end | 0) - $start | 0);
    $i = $sz - 1 | 0;
    while ($i >= 0) {
        $this.$buffer.data[$end + $i | 0] = $this.$buffer.data[$start + $i | 0];
        $i = $i + (-1) | 0;
    }
    $this.$length1 = $this.$length1 + ($end - $start | 0) | 0;
},
jl_Appendable = $rt_classWithoutFields(0),
jl_StringBuilder = $rt_classWithoutFields(jl_AbstractStringBuilder),
jl_StringBuilder__init_2 = ($this, $capacity) => {
    jl_AbstractStringBuilder__init_($this, $capacity);
},
jl_StringBuilder__init_0 = var_0 => {
    let var_1 = new jl_StringBuilder();
    jl_StringBuilder__init_2(var_1, var_0);
    return var_1;
},
jl_StringBuilder__init_1 = $this => {
    jl_AbstractStringBuilder__init_0($this);
},
jl_StringBuilder__init_ = () => {
    let var_0 = new jl_StringBuilder();
    jl_StringBuilder__init_1(var_0);
    return var_0;
},
jl_StringBuilder_append = ($this, $obj) => {
    jl_AbstractStringBuilder_append5($this, $obj);
    return $this;
},
jl_StringBuilder_append2 = ($this, $string) => {
    jl_AbstractStringBuilder_append($this, $string);
    return $this;
},
jl_StringBuilder_append1 = ($this, $value) => {
    jl_AbstractStringBuilder_append1($this, $value);
    return $this;
},
jl_StringBuilder_append0 = ($this, $c) => {
    jl_AbstractStringBuilder_append3($this, $c);
    return $this;
},
jl_StringBuilder_append3 = ($this, $chars, $offset, $len) => {
    jl_AbstractStringBuilder_append2($this, $chars, $offset, $len);
    return $this;
},
jl_StringBuilder_append6 = ($this, $chars) => {
    jl_AbstractStringBuilder_append0($this, $chars);
    return $this;
},
jl_StringBuilder_append8 = ($this, $s, $start, $end) => {
    jl_AbstractStringBuilder_append4($this, $s, $start, $end);
    return $this;
},
jl_StringBuilder_append7 = ($this, $s) => {
    jl_AbstractStringBuilder_append6($this, $s);
    return $this;
},
jl_StringBuilder_insert1 = ($this, $index, $s, $start, $end) => {
    jl_AbstractStringBuilder_insert2($this, $index, $s, $start, $end);
    return $this;
},
jl_StringBuilder_insert4 = ($this, $index, $chars, $offset, $len) => {
    jl_AbstractStringBuilder_insert($this, $index, $chars, $offset, $len);
    return $this;
},
jl_StringBuilder_insert5 = ($this, $index, $obj) => {
    jl_AbstractStringBuilder_insert3($this, $index, $obj);
    return $this;
},
jl_StringBuilder_insert2 = ($this, $index, $c) => {
    jl_AbstractStringBuilder_insert1($this, $index, $c);
    return $this;
},
jl_StringBuilder_delete = ($this, $start, $end) => {
    jl_AbstractStringBuilder_delete($this, $start, $end);
    return $this;
},
jl_StringBuilder_deleteCharAt = ($this, $index) => {
    jl_AbstractStringBuilder_deleteCharAt($this, $index);
    return $this;
},
jl_StringBuilder_insert7 = ($this, $index, $string) => {
    jl_AbstractStringBuilder_insert0($this, $index, $string);
    return $this;
},
jl_StringBuilder_insert6 = ($this, var$1, var$2, var$3, var$4) => {
    return $this.$insert5(var$1, var$2, var$3, var$4);
},
jl_StringBuilder_append5 = ($this, var$1, var$2, var$3) => {
    return $this.$append13(var$1, var$2, var$3);
},
jl_StringBuilder_insert3 = ($this, var$1, var$2, var$3, var$4) => {
    return $this.$insert6(var$1, var$2, var$3, var$4);
};
let jl_StringBuilder_append4 = ($this, var$1, var$2, var$3) => {
    return $this.$append14(var$1, var$2, var$3);
},
jl_StringBuilder_length = $this => {
    return jl_AbstractStringBuilder_length($this);
},
jl_StringBuilder_toString = $this => {
    return jl_AbstractStringBuilder_toString($this);
},
jl_StringBuilder_ensureCapacity = ($this, var$1) => {
    jl_AbstractStringBuilder_ensureCapacity($this, var$1);
},
jl_StringBuilder_insert0 = ($this, var$1, var$2) => {
    return $this.$insert7(var$1, var$2);
},
jl_StringBuilder_insert = ($this, var$1, var$2) => {
    return $this.$insert8(var$1, var$2);
},
jl_StringBuilder_insert8 = ($this, var$1, var$2) => {
    return $this.$insert9(var$1, var$2);
},
jur_AbstractCharClass$LazyAlnum = $rt_classWithoutFields(jur_AbstractCharClass$LazyAlpha),
jur_AbstractCharClass$LazyAlnum__init_ = $this => {
    jur_AbstractCharClass$LazyAlpha__init_($this);
},
jur_AbstractCharClass$LazyAlnum__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyAlnum();
    jur_AbstractCharClass$LazyAlnum__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyAlnum_computeValue = $this => {
    return (jur_AbstractCharClass$LazyAlpha_computeValue($this)).$add1(48, 57);
};
function jur_CompositeRangeSet() {
    let a = this; jur_JointSet.call(a);
    a.$withoutSurrogates = null;
    a.$withSurrogates = null;
}
let jur_CompositeRangeSet__init_0 = ($this, $withoutSurrogates, $withSurrogates) => {
    jur_JointSet__init_($this);
    $this.$withoutSurrogates = $withoutSurrogates;
    $this.$withSurrogates = $withSurrogates;
},
jur_CompositeRangeSet__init_ = (var_0, var_1) => {
    let var_2 = new jur_CompositeRangeSet();
    jur_CompositeRangeSet__init_0(var_2, var_0, var_1);
    return var_2;
},
jur_CompositeRangeSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $shift;
    $shift = $this.$withoutSurrogates.$matches($stringIndex, $testString, $matchResult);
    if ($shift < 0)
        $shift = $this.$withSurrogates.$matches($stringIndex, $testString, $matchResult);
    if ($shift >= 0)
        return $shift;
    return (-1);
},
jur_CompositeRangeSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
    $this.$withSurrogates.$setNext($next);
    $this.$withoutSurrogates.$setNext($next);
},
jur_CompositeRangeSet_hasConsumed = ($this, $matchResult) => {
    return 1;
},
jur_CompositeRangeSet_first = ($this, $set) => {
    return 1;
},
ju_ConcurrentModificationException = $rt_classWithoutFields(jl_RuntimeException),
ju_ConcurrentModificationException__init_0 = $this => {
    jl_RuntimeException__init_($this);
},
ju_ConcurrentModificationException__init_ = () => {
    let var_0 = new ju_ConcurrentModificationException();
    ju_ConcurrentModificationException__init_0(var_0);
    return var_0;
};
function owts_Puzzle$SortedBuckets() {
    jl_Object.call(this);
    this.$buckets = null;
}
let owts_Puzzle$SortedBuckets__init_0 = $this => {
    jl_Object__init_($this);
    $this.$buckets = ju_TreeSet__init_0();
},
owts_Puzzle$SortedBuckets__init_ = () => {
    let var_0 = new owts_Puzzle$SortedBuckets();
    owts_Puzzle$SortedBuckets__init_0(var_0);
    return var_0;
},
owts_Puzzle$SortedBuckets_add = ($this, $element, $value) => {
    let $bucket;
    $bucket = owts_Puzzle$Bucket__init_0($value);
    if (!$this.$buckets.$contains($bucket))
        $this.$buckets.$add($bucket);
    else
        $bucket = ($this.$buckets.$tailSet($bucket)).$first0();
    $bucket.$push($element);
},
owts_Puzzle$SortedBuckets_smallestValue = $this => {
    return ($this.$buckets.$first0()).$getValue1();
},
owts_Puzzle$SortedBuckets_isEmpty = $this => {
    return $this.$buckets.$size() ? 0 : 1;
},
owts_Puzzle$SortedBuckets_pop = $this => {
    let $bucket, $h;
    $bucket = $this.$buckets.$first0();
    $h = $bucket.$pop();
    if ($bucket.$isEmpty())
        $this.$buckets.$remove1($bucket);
    return $h;
},
jur_RandomGenerator = $rt_classWithoutFields(0),
jur_RandomGenerator_nextInt = ($this, $bound) => {
    let $mask, $res;
    otci_RandomUtils_checkBound($bound);
    $mask = (jl_Integer_highestOneBit($bound) << 1) - 1 | 0;
    while (true) {
        $res = $this.$nextInt0() & $mask;
        if ($res < $bound)
            break;
    }
    return $res;
};
function owtp_CubePuzzle$CubeMove() {
    let a = this; jl_Object.call(a);
    a.$face = null;
    a.$dir = 0;
    a.$innerSlice = 0;
    a.$outerSlice = 0;
    a.$this$010 = null;
}
let owtp_CubePuzzle$CubeMove_$assertionsDisabled = 0,
owtp_CubePuzzle$CubeMove_$callClinit = () => {
    owtp_CubePuzzle$CubeMove_$callClinit = $rt_eraseClinit(owtp_CubePuzzle$CubeMove);
    owtp_CubePuzzle$CubeMove__clinit_();
},
owtp_CubePuzzle$CubeMove__init_ = ($this, $this$0, $face, $dir, $innerSlice, $outerSlice) => {
    owtp_CubePuzzle$CubeMove_$callClinit();
    $this.$this$010 = $this$0;
    jl_Object__init_($this);
    $this.$face = $face;
    $this.$dir = $dir;
    $this.$innerSlice = $innerSlice;
    $this.$outerSlice = $outerSlice;
    if (!owtp_CubePuzzle$CubeMove_$assertionsDisabled && $outerSlice)
        $rt_throw(jl_AssertionError__init_());
},
owtp_CubePuzzle$CubeMove__init_0 = (var_0, var_1, var_2, var_3, var_4) => {
    let var_5 = new owtp_CubePuzzle$CubeMove();
    owtp_CubePuzzle$CubeMove__init_(var_5, var_0, var_1, var_2, var_3, var_4);
    return var_5;
},
owtp_CubePuzzle$CubeMove_toString = $this => {
    let $move, var$2;
    $move = $this.$face.$toString();
    if ($this.$innerSlice) {
        if ($this.$innerSlice == 1)
            $move = (((jl_StringBuilder__init_()).$append1($move)).$append1($rt_s(27))).$toString();
        else if ($this.$innerSlice == ($this.$this$010.$size0 - 1 | 0)) {
            $move = (owtp_CubePuzzle_access$000()).$get($this.$face);
            if ($move === null)
                return null;
        } else
            $move = ((((jl_StringBuilder__init_()).$append3($this.$innerSlice + 1 | 0)).$append1($move)).$append1($rt_s(27))).$toString();
    }
    var$2 = (((jl_StringBuilder__init_()).$append1($move)).$append1((owtp_CubePuzzle_access$100()).data[$this.$dir])).$toString();
    return var$2;
},
owtp_CubePuzzle$CubeMove__clinit_ = () => {
    owtp_CubePuzzle$CubeMove_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_CubePuzzle)) ? 0 : 1;
};
function jur_LowHighSurrogateRangeSet() {
    let a = this; jur_JointSet.call(a);
    a.$surrChars = null;
    a.$alt0 = 0;
}
let jur_LowHighSurrogateRangeSet__init_ = ($this, $surrChars) => {
    jur_JointSet__init_($this);
    $this.$surrChars = $surrChars.$getInstance();
    $this.$alt0 = $surrChars.$alt;
},
jur_LowHighSurrogateRangeSet__init_0 = var_0 => {
    let var_1 = new jur_LowHighSurrogateRangeSet();
    jur_LowHighSurrogateRangeSet__init_(var_1, var_0);
    return var_1;
},
jur_LowHighSurrogateRangeSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_LowHighSurrogateRangeSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $startStr, $strLength, var$6, var$7, $ch, $low, $high;
    $startStr = $matchResult.$getLeftBound();
    $strLength = $matchResult.$getRightBound();
    var$6 = $stringIndex + 1 | 0;
    var$7 = $rt_compare(var$6, $strLength);
    if (var$7 > 0) {
        $matchResult.$hitEnd = 1;
        return (-1);
    }
    $ch = $testString.$charAt($stringIndex);
    if (!$this.$surrChars.$contains0($ch))
        return (-1);
    if (jl_Character_isHighSurrogate($ch)) {
        if (var$7 < 0) {
            $low = $testString.$charAt(var$6);
            if (jl_Character_isLowSurrogate($low))
                return (-1);
        }
    } else if (jl_Character_isLowSurrogate($ch) && $stringIndex > $startStr) {
        $high = $testString.$charAt($stringIndex - 1 | 0);
        if (jl_Character_isHighSurrogate($high))
            return (-1);
    }
    return $this.$next3.$matches(var$6, $testString, $matchResult);
},
jur_ReluctantGroupQuantifierSet = $rt_classWithoutFields(jur_GroupQuantifierSet),
jur_ReluctantGroupQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_GroupQuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_ReluctantGroupQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_ReluctantGroupQuantifierSet();
    jur_ReluctantGroupQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_ReluctantGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $res;
    if (!$this.$innerSet.$hasConsumed($matchResult))
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    $res = $this.$next3.$matches($stringIndex, $testString, $matchResult);
    if ($res >= 0)
        return $res;
    return $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
},
jur_FinalSet = $rt_classWithoutFields(jur_FSet),
jur_FinalSet__init_ = $this => {
    jur_FSet__init_($this, 0);
},
jur_FinalSet__init_0 = () => {
    let var_0 = new jur_FinalSet();
    jur_FinalSet__init_(var_0);
    return var_0;
},
jur_FinalSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    if ($matchResult.$mode() != 1 && $stringIndex != $matchResult.$getRightBound())
        return (-1);
    $matchResult.$setValid();
    $matchResult.$setEnd(0, $stringIndex);
    return $stringIndex;
};
function ju_Random() {
    jl_Object.call(this);
    this.$seed = Long_ZERO;
}
let ju_Random__init_0 = $this => {
    ju_Random__init_($this, Long_fromNumber(jl_Math_random() * 2.81474976710656E14 - 1.0));
},
ju_Random__init_1 = () => {
    let var_0 = new ju_Random();
    ju_Random__init_0(var_0);
    return var_0;
},
ju_Random__init_ = ($this, $seed) => {
    jl_Object__init_($this);
    $this.$setSeed($seed);
},
ju_Random__init_2 = var_0 => {
    let var_1 = new ju_Random();
    ju_Random__init_(var_1, var_0);
    return var_1;
},
ju_Random_setSeed = ($this, $seed) => {
    $this.$seed = Long_and(Long_xor($seed, Long_create(3740067437, 5)), Long_create(4294967295, 65535));
},
ju_Random_nextInt = $this => {
    return $this.$next0(32);
},
ju_Random_next = ($this, $bits) => {
    let $newSeed;
    $newSeed = Long_and(Long_add(Long_mul($this.$seed, Long_create(3740067437, 5)), Long_fromInt(11)), Long_create(4294967295, 65535));
    $this.$seed = $newSeed;
    return Long_lo(Long_shr($newSeed, 48 - $bits | 0));
},
WatchTNoodle$WatchRandom = $rt_classWithoutFields(ju_Random),
WatchTNoodle$WatchRandom__init_ = ($this, $seed) => {
    ju_Random__init_($this, $seed);
},
WatchTNoodle$WatchRandom__init_0 = var_0 => {
    let var_1 = new WatchTNoodle$WatchRandom();
    WatchTNoodle$WatchRandom__init_(var_1, var_0);
    return var_1;
},
WatchTNoodle$WatchRandom_nextInt = ($this, $bound) => {
    let $mask, $bits, $value;
    if ($bound <= 0)
        $rt_throw(jl_IllegalArgumentException__init_0($rt_s(28)));
    $mask = $bound - 1 | 0;
    $bits = $this.$next0(31);
    if (!($bound & $mask))
        return Long_lo(Long_shr(Long_mul(Long_fromInt($bound), Long_fromInt($bits)), 31));
    $value = $bits % $bound | 0;
    while ((($bits - $value | 0) + $mask | 0) < 0) {
        $bits = $this.$next0(31);
        $value = $bits % $bound | 0;
    }
    return $value;
},
jl_ClassCastException = $rt_classWithoutFields(jl_RuntimeException),
juf_Supplier = $rt_classWithoutFields(0),
jl_Cloneable = $rt_classWithoutFields(0);
function ju_HashMap() {
    let a = this; ju_AbstractMap.call(a);
    a.$elementCount = 0;
    a.$elementData = null;
    a.$modCount0 = 0;
    a.$loadFactor0 = 0.0;
    a.$threshold = 0;
}
let ju_HashMap_newElementArray = ($this, $s) => {
    return $rt_createArray(ju_HashMap$HashEntry, $s);
},
ju_HashMap__init_1 = $this => {
    ju_HashMap__init_0($this, 16);
},
ju_HashMap__init_ = () => {
    let var_0 = new ju_HashMap();
    ju_HashMap__init_1(var_0);
    return var_0;
},
ju_HashMap__init_0 = ($this, $capacity) => {
    ju_HashMap__init_2($this, $capacity, 0.75);
},
ju_HashMap__init_3 = var_0 => {
    let var_1 = new ju_HashMap();
    ju_HashMap__init_0(var_1, var_0);
    return var_1;
},
ju_HashMap_calculateCapacity = $x => {
    let var$2, var$3;
    if ($x >= 1073741824)
        return 1073741824;
    if (!$x)
        return 16;
    var$2 = $x - 1 | 0;
    var$3 = var$2 | var$2 >> 1;
    var$3 = var$3 | var$3 >> 2;
    var$3 = var$3 | var$3 >> 4;
    var$3 = var$3 | var$3 >> 8;
    var$3 = var$3 | var$3 >> 16;
    return var$3 + 1 | 0;
},
ju_HashMap__init_2 = ($this, $capacity, $loadFactor) => {
    let var$3;
    ju_AbstractMap__init_($this);
    if ($capacity >= 0 && $loadFactor > 0.0) {
        var$3 = ju_HashMap_calculateCapacity($capacity);
        $this.$elementCount = 0;
        $this.$elementData = $this.$newElementArray(var$3);
        $this.$loadFactor0 = $loadFactor;
        ju_HashMap_computeThreshold($this);
        return;
    }
    $rt_throw(jl_IllegalArgumentException__init_());
},
ju_HashMap__init_4 = (var_0, var_1) => {
    let var_2 = new ju_HashMap();
    ju_HashMap__init_2(var_2, var_0, var_1);
    return var_2;
},
ju_HashMap_computeThreshold = $this => {
    $this.$threshold = $this.$elementData.data.length * $this.$loadFactor0 | 0;
},
ju_HashMap_containsKey = ($this, $key) => {
    let $m;
    $m = ju_HashMap_entryByKey($this, $key);
    return $m === null ? 0 : 1;
},
ju_HashMap_entrySet = $this => {
    return ju_HashMap$HashMapEntrySet__init_0($this);
},
ju_HashMap_get = ($this, $key) => {
    let $m;
    $m = ju_HashMap_entryByKey($this, $key);
    if ($m === null)
        return null;
    return $m.$value;
},
ju_HashMap_entryByKey = ($this, $key) => {
    let $m, $hash, $index;
    if ($key === null)
        $m = ju_HashMap_findNullKeyEntry($this);
    else {
        $hash = $key.$hashCode();
        $index = $hash & ($this.$elementData.data.length - 1 | 0);
        $m = ju_HashMap_findNonNullKeyEntry($this, $key, $index, $hash);
    }
    return $m;
},
ju_HashMap_findNonNullKeyEntry = ($this, $key, $index, $keyHash) => {
    let $m;
    $m = $this.$elementData.data[$index];
    while ($m !== null && !($m.$origKeyHash == $keyHash && ju_HashMap_areEqualKeys($key, $m.$key))) {
        $m = $m.$next4;
    }
    return $m;
},
ju_HashMap_findNullKeyEntry = $this => {
    let $m;
    $m = $this.$elementData.data[0];
    while ($m !== null && $m.$key !== null) {
        $m = $m.$next4;
    }
    return $m;
},
ju_HashMap_keySet = $this => {
    if ($this.$cachedKeySet === null)
        $this.$cachedKeySet = ju_HashMap$1__init_0($this);
    return $this.$cachedKeySet;
},
ju_HashMap_put = ($this, $key, $value) => {
    return ju_HashMap_putImpl($this, $key, $value);
},
ju_HashMap_putImpl = ($this, $key, $value) => {
    let $entry, var$4, $hash, $index, $result;
    if ($key === null) {
        $entry = ju_HashMap_findNullKeyEntry($this);
        if ($entry === null) {
            $this.$modCount0 = $this.$modCount0 + 1 | 0;
            $entry = ju_HashMap_createHashedEntry($this, null, 0, 0);
            var$4 = $this.$elementCount + 1 | 0;
            $this.$elementCount = var$4;
            if (var$4 > $this.$threshold)
                $this.$rehash();
        }
    } else {
        $hash = $key.$hashCode();
        $index = $hash & ($this.$elementData.data.length - 1 | 0);
        $entry = ju_HashMap_findNonNullKeyEntry($this, $key, $index, $hash);
        if ($entry === null) {
            $this.$modCount0 = $this.$modCount0 + 1 | 0;
            $entry = ju_HashMap_createHashedEntry($this, $key, $index, $hash);
            var$4 = $this.$elementCount + 1 | 0;
            $this.$elementCount = var$4;
            if (var$4 > $this.$threshold)
                $this.$rehash();
        }
    }
    $result = $entry.$value;
    $entry.$value = $value;
    return $result;
},
ju_HashMap_createHashedEntry = ($this, $key, $index, $hash) => {
    let $entry;
    $entry = ju_HashMap$HashEntry__init_0($key, $hash);
    $entry.$next4 = $this.$elementData.data[$index];
    $this.$elementData.data[$index] = $entry;
    return $entry;
},
ju_HashMap_rehash0 = ($this, $capacity) => {
    let $length, $newData, $i, $entry, var$6, $index, $next;
    $length = ju_HashMap_calculateCapacity(!$capacity ? 1 : $capacity << 1);
    $newData = $this.$newElementArray($length);
    $i = 0;
    while ($i < $this.$elementData.data.length) {
        $entry = $this.$elementData.data[$i];
        $this.$elementData.data[$i] = null;
        while ($entry !== null) {
            var$6 = $newData.data;
            $index = $entry.$origKeyHash & ($length - 1 | 0);
            $next = $entry.$next4;
            $entry.$next4 = var$6[$index];
            var$6[$index] = $entry;
            $entry = $next;
        }
        $i = $i + 1 | 0;
    }
    $this.$elementData = $newData;
    ju_HashMap_computeThreshold($this);
},
ju_HashMap_rehash = $this => {
    $this.$rehash0($this.$elementData.data.length);
},
ju_HashMap_removeEntry = ($this, $entry) => {
    let $index, $m;
    $index = $entry.$origKeyHash & ($this.$elementData.data.length - 1 | 0);
    $m = $this.$elementData.data[$index];
    if ($m === $entry)
        $this.$elementData.data[$index] = $entry.$next4;
    else {
        while ($m.$next4 !== $entry) {
            $m = $m.$next4;
        }
        $m.$next4 = $entry.$next4;
    }
    $this.$modCount0 = $this.$modCount0 + 1 | 0;
    $this.$elementCount = $this.$elementCount - 1 | 0;
},
ju_HashMap_size = $this => {
    return $this.$elementCount;
},
ju_HashMap_areEqualKeys = ($key1, $key2) => {
    return $key1 !== $key2 && !$key1.$equals($key2) ? 0 : 1;
};
function ju_LinkedHashMap() {
    let a = this; ju_HashMap.call(a);
    a.$accessOrder = 0;
    a.$head = null;
    a.$tail = null;
}
let ju_LinkedHashMap__init_0 = $this => {
    ju_HashMap__init_1($this);
    $this.$accessOrder = 0;
    $this.$head = null;
},
ju_LinkedHashMap__init_ = () => {
    let var_0 = new ju_LinkedHashMap();
    ju_LinkedHashMap__init_0(var_0);
    return var_0;
},
ju_LinkedHashMap_newElementArray = ($this, $s) => {
    return $rt_createArray(ju_LinkedHashMap$LinkedHashMapEntry, $s);
},
ju_LinkedHashMap_getOrDefault = ($this, $key, $defaultValue) => {
    let $entry, $hash, $index;
    if ($key === null)
        $entry = ju_HashMap_findNullKeyEntry($this);
    else {
        $hash = $key.$hashCode();
        $index = ($hash & 2147483647) % $this.$elementData.data.length | 0;
        $entry = ju_HashMap_findNonNullKeyEntry($this, $key, $index, $hash);
    }
    if ($entry === null)
        return $defaultValue;
    if ($this.$accessOrder)
        ju_LinkedHashMap_linkEntry($this, $entry, 0);
    return $entry.$value;
},
ju_LinkedHashMap_get = ($this, $key) => {
    return $this.$getOrDefault($key, null);
},
ju_LinkedHashMap_createHashedEntry = ($this, $key, $index, $hash, $first) => {
    let $entry;
    $entry = ju_LinkedHashMap$LinkedHashMapEntry__init_0($key, $hash);
    $entry.$next4 = $this.$elementData.data[$index];
    $this.$elementData.data[$index] = $entry;
    if (!$first) {
        if ($this.$tail === null)
            $this.$head = $entry;
        else
            $this.$tail.$chainForward = $entry;
        $entry.$chainBackward = $this.$tail;
        $this.$tail = $entry;
    } else {
        if ($this.$head === null)
            $this.$tail = $entry;
        else
            $this.$head.$chainBackward = $entry;
        $entry.$chainForward = $this.$head;
        $this.$head = $entry;
    }
    return $entry;
},
ju_LinkedHashMap_put = ($this, $key, $value) => {
    let $oldSize, $existing;
    $oldSize = $this.$size();
    $existing = $this.$putImpl0($key, $value, 0, $this.$accessOrder);
    if ($this.$size() != $oldSize && $this.$removeEldestEntry($this.$head))
        $this.$removeLinkedEntry($this.$head);
    return $existing;
},
ju_LinkedHashMap_putImpl = ($this, $key, $value, $first, $forceMotion) => {
    let $hash, var$6, $index, $entry, var$9, $existing;
    if (!$this.$elementCount) {
        $this.$head = null;
        $this.$tail = null;
    }
    $hash = ju_Objects_hashCode($key);
    var$6 = $hash & 2147483647;
    $index = var$6 % $this.$elementData.data.length | 0;
    $entry = $key === null ? ju_HashMap_findNullKeyEntry($this) : ju_HashMap_findNonNullKeyEntry($this, $key, $index, $hash);
    if ($entry === null) {
        $this.$modCount0 = $this.$modCount0 + 1 | 0;
        var$9 = $this.$elementCount + 1 | 0;
        $this.$elementCount = var$9;
        if (var$9 > $this.$threshold) {
            $this.$rehash();
            $index = var$6 % $this.$elementData.data.length | 0;
        }
        $entry = ju_LinkedHashMap_createHashedEntry($this, $key, $index, $hash, $first);
    } else if ($forceMotion)
        ju_LinkedHashMap_linkEntry($this, $entry, $first);
    $existing = $entry.$value;
    $entry.$value = $value;
    return $existing;
},
ju_LinkedHashMap_linkEntry = ($this, $entry, $first) => {
    let $n, $p;
    if (!$first) {
        $n = $entry.$chainForward;
        if ($n === null)
            return;
        $p = $entry.$chainBackward;
        if ($p === null)
            $this.$head = $n;
        else
            $p.$chainForward = $n;
        $n.$chainBackward = $p;
        if ($this.$tail !== null)
            $this.$tail.$chainForward = $entry;
        $entry.$chainBackward = $this.$tail;
        $entry.$chainForward = null;
        $this.$tail = $entry;
    } else {
        $p = $entry.$chainBackward;
        if ($p === null)
            return;
        $n = $entry.$chainForward;
        if ($n === null)
            $this.$tail = $p;
        else
            $n.$chainBackward = $p;
        $p.$chainForward = $n;
        if ($this.$head !== null)
            $this.$head.$chainBackward = $entry;
        $entry.$chainForward = $this.$head;
        $entry.$chainBackward = null;
        $this.$head = $entry;
    }
},
ju_LinkedHashMap_entrySet = $this => {
    return ju_LinkedHashMapEntrySet__init_0($this, 0);
},
ju_LinkedHashMap_removeLinkedEntry = ($this, $entry) => {
    ju_HashMap_removeEntry($this, $entry);
    ju_LinkedHashMap_unlinkEntry($this, $entry);
},
ju_LinkedHashMap_unlinkEntry = ($this, $entry) => {
    let $p, $n;
    $p = $entry.$chainBackward;
    $n = $entry.$chainForward;
    if ($p !== null) {
        $p.$chainForward = $n;
        if ($n === null)
            $this.$tail = $p;
        else
            $n.$chainBackward = $p;
    } else {
        $this.$head = $n;
        if ($n === null)
            $this.$tail = null;
        else
            $n.$chainBackward = null;
    }
},
ju_LinkedHashMap_removeEldestEntry = ($this, $eldest) => {
    return 0;
},
jur_PosPlusGroupQuantifierSet = $rt_classWithoutFields(jur_GroupQuantifierSet),
jur_PosPlusGroupQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_GroupQuantifierSet__init_($this, $innerSet, $next, $type);
    jur_FSet_$callClinit();
    $innerSet.$setNext(jur_FSet_posFSet);
},
jur_PosPlusGroupQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_PosPlusGroupQuantifierSet();
    jur_PosPlusGroupQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_PosPlusGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $nextIndex, var$5;
    $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    if ($nextIndex < 0)
        return (-1);
    if ($nextIndex > $stringIndex) {
        while (true) {
            var$5 = $this.$innerSet.$matches($nextIndex, $testString, $matchResult);
            if (var$5 <= $nextIndex)
                break;
            $nextIndex = var$5;
        }
        $stringIndex = $nextIndex;
    }
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_EmptySet = $rt_classWithoutFields(jur_LeafSet),
jur_EmptySet__init_0 = ($this, $next) => {
    jur_LeafSet__init_0($this, $next);
    $this.$charCount0 = 0;
},
jur_EmptySet__init_ = var_0 => {
    let var_1 = new jur_EmptySet();
    jur_EmptySet__init_0(var_1, var_0);
    return var_1;
},
jur_EmptySet_accepts = ($this, $stringIndex, $testString) => {
    return 0;
},
jur_EmptySet_find = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength, $startStr, var$6, $low, $high;
    $strLength = $matchResult.$getRightBound();
    $startStr = $matchResult.$getLeftBound();
    while (true) {
        var$6 = $rt_compare($stringIndex, $strLength);
        if (var$6 > 0)
            return (-1);
        if (var$6 < 0) {
            $low = $testString.$charAt($stringIndex);
            if (jl_Character_isLowSurrogate($low) && $stringIndex > $startStr) {
                $high = $testString.$charAt($stringIndex - 1 | 0);
                if (jl_Character_isHighSurrogate($high)) {
                    $stringIndex = $stringIndex + 1 | 0;
                    continue;
                }
            }
        }
        if ($this.$next3.$matches($stringIndex, $testString, $matchResult) >= 0)
            break;
        $stringIndex = $stringIndex + 1 | 0;
    }
    return $stringIndex;
},
jur_EmptySet_findBack = ($this, $stringIndex, $startSearch, $testString, $matchResult) => {
    let $strLength, $startStr, $low, $high;
    $strLength = $matchResult.$getRightBound();
    $startStr = $matchResult.$getLeftBound();
    while (true) {
        if ($startSearch < $stringIndex)
            return (-1);
        if ($startSearch < $strLength) {
            $low = $testString.$charAt($startSearch);
            if (jl_Character_isLowSurrogate($low) && $startSearch > $startStr) {
                $high = $testString.$charAt($startSearch - 1 | 0);
                if (jl_Character_isHighSurrogate($high)) {
                    $startSearch = $startSearch + (-1) | 0;
                    continue;
                }
            }
        }
        if ($this.$next3.$matches($startSearch, $testString, $matchResult) >= 0)
            break;
        $startSearch = $startSearch + (-1) | 0;
    }
    return $startSearch;
},
jur_EmptySet_hasConsumed = ($this, $mr) => {
    return 0;
},
jl_StringBuffer = $rt_classWithoutFields(jl_AbstractStringBuilder),
jl_StringBuffer__init_0 = $this => {
    jl_AbstractStringBuilder__init_0($this);
},
jl_StringBuffer__init_ = () => {
    let var_0 = new jl_StringBuffer();
    jl_StringBuffer__init_0(var_0);
    return var_0;
},
jl_StringBuffer_append0 = ($this, $string) => {
    jl_AbstractStringBuilder_append($this, $string);
    return $this;
},
jl_StringBuffer_append1 = ($this, $value) => {
    jl_AbstractStringBuilder_append1($this, $value);
    return $this;
},
jl_StringBuffer_append3 = ($this, $c) => {
    jl_AbstractStringBuilder_append3($this, $c);
    return $this;
},
jl_StringBuffer_append4 = ($this, $chars, $offset, $len) => {
    jl_AbstractStringBuilder_append2($this, $chars, $offset, $len);
    return $this;
},
jl_StringBuffer_append2 = ($this, $chars) => {
    jl_AbstractStringBuilder_append0($this, $chars);
    return $this;
},
jl_StringBuffer_insert0 = ($this, $index, $chars, $offset, $len) => {
    jl_AbstractStringBuilder_insert($this, $index, $chars, $offset, $len);
    return $this;
},
jl_StringBuffer_insert4 = ($this, $index, $c) => {
    jl_AbstractStringBuilder_insert1($this, $index, $c);
    return $this;
},
jl_StringBuffer_insert1 = ($this, $index, $string) => {
    jl_AbstractStringBuilder_insert0($this, $index, $string);
    return $this;
},
jl_StringBuffer_insert3 = ($this, var$1, var$2, var$3, var$4) => {
    return $this.$insert10(var$1, var$2, var$3, var$4);
},
jl_StringBuffer_append = ($this, var$1, var$2, var$3) => {
    return $this.$append15(var$1, var$2, var$3);
},
jl_StringBuffer_charAt = ($this, var$1) => {
    return jl_AbstractStringBuilder_charAt($this, var$1);
},
jl_StringBuffer_length = $this => {
    return jl_AbstractStringBuilder_length($this);
},
jl_StringBuffer_toString = $this => {
    return jl_AbstractStringBuilder_toString($this);
},
jl_StringBuffer_ensureCapacity = ($this, var$1) => {
    jl_AbstractStringBuilder_ensureCapacity($this, var$1);
},
jl_StringBuffer_insert2 = ($this, var$1, var$2) => {
    return $this.$insert11(var$1, var$2);
},
jl_StringBuffer_insert = ($this, var$1, var$2) => {
    return $this.$insert12(var$1, var$2);
};
function owtp_SkewbSolver$SkewbSolverState() {
    let a = this; jl_Object.call(a);
    a.$perm = 0;
    a.$twst = 0;
}
let owtp_SkewbSolver$SkewbSolverState__init_ = $this => {
    jl_Object__init_($this);
},
owtp_SkewbSolver$SkewbSolverState__init_0 = () => {
    let var_0 = new owtp_SkewbSolver$SkewbSolverState();
    owtp_SkewbSolver$SkewbSolverState__init_(var_0);
    return var_0;
},
owtp_SkewbSolver$SkewbSolverState_isSolvable = $this => {
    return (owtp_SkewbSolver_access$000()).data[$this.$perm % 12 | 0] != (((($this.$twst + ($this.$twst / 3 | 0) | 0) + ($this.$twst / 9 | 0) | 0) + ($this.$twst / 27 | 0) | 0) % 3 | 0) ? 0 : 1;
};
function jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1() {
    jur_AbstractCharClass.call(this);
    this.$this$014 = null;
}
let jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1__init_ = ($this, $this$0) => {
    $this.$this$014 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1();
    jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1_contains = ($this, $ch) => {
    return jl_Character_isUnicodeIdentifierPart($ch);
},
jur_AbstractCharClass$PredefinedCharacterClasses = $rt_classWithoutFields(),
jur_AbstractCharClass$PredefinedCharacterClasses_space = null,
jur_AbstractCharClass$PredefinedCharacterClasses_digit = null,
jur_AbstractCharClass$PredefinedCharacterClasses_contents = null,
jur_AbstractCharClass$PredefinedCharacterClasses_$callClinit = () => {
    jur_AbstractCharClass$PredefinedCharacterClasses_$callClinit = $rt_eraseClinit(jur_AbstractCharClass$PredefinedCharacterClasses);
    jur_AbstractCharClass$PredefinedCharacterClasses__clinit_();
},
jur_AbstractCharClass$PredefinedCharacterClasses__init_ = $this => {
    jur_AbstractCharClass$PredefinedCharacterClasses_$callClinit();
    jl_Object__init_($this);
},
jur_AbstractCharClass$PredefinedCharacterClasses__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$PredefinedCharacterClasses();
    jur_AbstractCharClass$PredefinedCharacterClasses__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$PredefinedCharacterClasses_getObject = ($this, $name) => {
    let $i, $row, var$4;
    $i = 0;
    while (true) {
        jur_AbstractCharClass$PredefinedCharacterClasses_$callClinit();
        if ($i >= jur_AbstractCharClass$PredefinedCharacterClasses_contents.data.length)
            $rt_throw(ju_MissingResourceException__init_0($rt_s(3), $rt_s(3), $name));
        $row = jur_AbstractCharClass$PredefinedCharacterClasses_contents.data[$i];
        var$4 = $row.data;
        if ($name.$equals(var$4[0]))
            break;
        $i = $i + 1 | 0;
    }
    return var$4[1];
},
jur_AbstractCharClass$PredefinedCharacterClasses__clinit_ = () => {
    let var$1, var$2, var$3, var$4;
    jur_AbstractCharClass$PredefinedCharacterClasses_space = jur_AbstractCharClass$LazySpace__init_0();
    jur_AbstractCharClass$PredefinedCharacterClasses_digit = jur_AbstractCharClass$LazyDigit__init_0();
    var$1 = $rt_createArray($rt_arraycls(jl_Object), 194);
    var$2 = var$1.data;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(29);
    var$4[1] = jur_AbstractCharClass$LazyLower__init_0();
    var$2[0] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(30);
    var$4[1] = jur_AbstractCharClass$LazyUpper__init_0();
    var$2[1] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(31);
    var$4[1] = jur_AbstractCharClass$LazyASCII__init_0();
    var$2[2] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(32);
    var$4[1] = jur_AbstractCharClass$LazyAlpha__init_0();
    var$2[3] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(33);
    var$4[1] = jur_AbstractCharClass$PredefinedCharacterClasses_digit;
    var$2[4] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(34);
    var$4[1] = jur_AbstractCharClass$LazyAlnum__init_0();
    var$2[5] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(35);
    var$4[1] = jur_AbstractCharClass$LazyPunct__init_0();
    var$2[6] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(36);
    var$4[1] = jur_AbstractCharClass$LazyGraph__init_0();
    var$2[7] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(37);
    var$4[1] = jur_AbstractCharClass$LazyPrint__init_0();
    var$2[8] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(38);
    var$4[1] = jur_AbstractCharClass$LazyBlank__init_0();
    var$2[9] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(39);
    var$4[1] = jur_AbstractCharClass$LazyCntrl__init_0();
    var$2[10] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(40);
    var$4[1] = jur_AbstractCharClass$LazyXDigit__init_0();
    var$2[11] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(41);
    var$4[1] = jur_AbstractCharClass$LazyJavaLowerCase__init_0();
    var$2[12] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(42);
    var$4[1] = jur_AbstractCharClass$LazyJavaUpperCase__init_0();
    var$2[13] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(43);
    var$4[1] = jur_AbstractCharClass$LazyJavaWhitespace__init_0();
    var$2[14] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(44);
    var$4[1] = jur_AbstractCharClass$LazyJavaMirrored__init_0();
    var$2[15] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(45);
    var$4[1] = jur_AbstractCharClass$LazyJavaDefined__init_0();
    var$2[16] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(46);
    var$4[1] = jur_AbstractCharClass$LazyJavaDigit__init_0();
    var$2[17] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(47);
    var$4[1] = jur_AbstractCharClass$LazyJavaIdentifierIgnorable__init_0();
    var$2[18] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(48);
    var$4[1] = jur_AbstractCharClass$LazyJavaISOControl__init_0();
    var$2[19] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(49);
    var$4[1] = jur_AbstractCharClass$LazyJavaJavaIdentifierPart__init_0();
    var$2[20] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(50);
    var$4[1] = jur_AbstractCharClass$LazyJavaJavaIdentifierStart__init_0();
    var$2[21] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(51);
    var$4[1] = jur_AbstractCharClass$LazyJavaLetter__init_0();
    var$2[22] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(52);
    var$4[1] = jur_AbstractCharClass$LazyJavaLetterOrDigit__init_0();
    var$2[23] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(53);
    var$4[1] = jur_AbstractCharClass$LazyJavaSpaceChar__init_0();
    var$2[24] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(54);
    var$4[1] = jur_AbstractCharClass$LazyJavaTitleCase__init_0();
    var$2[25] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(55);
    var$4[1] = jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart__init_0();
    var$2[26] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(56);
    var$4[1] = jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart__init_0();
    var$2[27] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(57);
    var$4[1] = jur_AbstractCharClass$PredefinedCharacterClasses_space;
    var$2[28] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(27);
    var$4[1] = jur_AbstractCharClass$LazyWord__init_0();
    var$2[29] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(58);
    var$4[1] = jur_AbstractCharClass$LazyNonWord__init_0();
    var$2[30] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(59);
    var$4[1] = jur_AbstractCharClass$PredefinedCharacterClasses_space;
    var$2[31] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(60);
    var$4[1] = jur_AbstractCharClass$LazyNonSpace__init_0();
    var$2[32] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(61);
    var$4[1] = jur_AbstractCharClass$PredefinedCharacterClasses_digit;
    var$2[33] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(62);
    var$4[1] = jur_AbstractCharClass$LazyNonDigit__init_0();
    var$2[34] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(63);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(0, 127);
    var$2[35] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(64);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(128, 255);
    var$2[36] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(65);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(256, 383);
    var$2[37] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(66);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(384, 591);
    var$2[38] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(67);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(592, 687);
    var$2[39] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(68);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(688, 767);
    var$2[40] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(69);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(768, 879);
    var$2[41] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(70);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(880, 1023);
    var$2[42] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(71);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(1024, 1279);
    var$2[43] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(72);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(1280, 1327);
    var$2[44] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(73);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(1328, 1423);
    var$2[45] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(74);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(1424, 1535);
    var$2[46] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(75);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(1536, 1791);
    var$2[47] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(76);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(1792, 1871);
    var$2[48] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(77);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(1872, 1919);
    var$2[49] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(78);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(1920, 1983);
    var$2[50] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(79);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(2304, 2431);
    var$2[51] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(80);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(2432, 2559);
    var$2[52] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(81);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(2560, 2687);
    var$2[53] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(82);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(2688, 2815);
    var$2[54] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(83);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(2816, 2943);
    var$2[55] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(84);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(2944, 3071);
    var$2[56] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(85);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(3072, 3199);
    var$2[57] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(86);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(3200, 3327);
    var$2[58] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(87);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(3328, 3455);
    var$2[59] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(88);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(3456, 3583);
    var$2[60] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(89);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(3584, 3711);
    var$2[61] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(90);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(3712, 3839);
    var$2[62] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(91);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(3840, 4095);
    var$2[63] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(92);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(4096, 4255);
    var$2[64] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(93);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(4256, 4351);
    var$2[65] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(94);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(4352, 4607);
    var$2[66] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(95);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(4608, 4991);
    var$2[67] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(96);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(4992, 5023);
    var$2[68] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(97);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(5024, 5119);
    var$2[69] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(98);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(5120, 5759);
    var$2[70] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(99);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(5760, 5791);
    var$2[71] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(100);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(5792, 5887);
    var$2[72] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(101);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(5888, 5919);
    var$2[73] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(102);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(5920, 5951);
    var$2[74] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(103);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(5952, 5983);
    var$2[75] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(104);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(5984, 6015);
    var$2[76] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(105);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(6016, 6143);
    var$2[77] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(106);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(6144, 6319);
    var$2[78] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(107);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(6400, 6479);
    var$2[79] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(108);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(6480, 6527);
    var$2[80] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(109);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(6528, 6623);
    var$2[81] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(110);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(6624, 6655);
    var$2[82] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(111);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(6656, 6687);
    var$2[83] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(112);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(7424, 7551);
    var$2[84] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(113);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(7552, 7615);
    var$2[85] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(114);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(7616, 7679);
    var$2[86] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(115);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(7680, 7935);
    var$2[87] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(116);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(7936, 8191);
    var$2[88] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(117);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8192, 8303);
    var$2[89] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(118);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8304, 8351);
    var$2[90] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(119);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8352, 8399);
    var$2[91] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(120);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8400, 8447);
    var$2[92] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(121);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8448, 8527);
    var$2[93] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(122);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8528, 8591);
    var$2[94] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(123);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8592, 8703);
    var$2[95] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(124);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8704, 8959);
    var$2[96] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(125);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(8960, 9215);
    var$2[97] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(126);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(9216, 9279);
    var$2[98] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(127);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(9280, 9311);
    var$2[99] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(128);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(9312, 9471);
    var$2[100] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(129);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(9472, 9599);
    var$2[101] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(130);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(9600, 9631);
    var$2[102] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(131);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(9632, 9727);
    var$2[103] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(132);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(9728, 9983);
    var$2[104] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(133);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(9984, 10175);
    var$2[105] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(134);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(10176, 10223);
    var$2[106] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(135);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(10224, 10239);
    var$2[107] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(136);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(10240, 10495);
    var$2[108] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(137);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(10496, 10623);
    var$2[109] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(138);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(10624, 10751);
    var$2[110] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(139);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(10752, 11007);
    var$2[111] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(140);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(11008, 11263);
    var$2[112] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(141);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(11264, 11359);
    var$2[113] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(142);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(11392, 11519);
    var$2[114] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(143);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(11520, 11567);
    var$2[115] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(144);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(11568, 11647);
    var$2[116] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(145);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(11648, 11743);
    var$2[117] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(146);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(11776, 11903);
    var$2[118] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(147);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(11904, 12031);
    var$2[119] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(148);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12032, 12255);
    var$2[120] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(149);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12272, 12287);
    var$2[121] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(150);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12288, 12351);
    var$2[122] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(151);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12352, 12447);
    var$2[123] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(152);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12448, 12543);
    var$2[124] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(153);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12544, 12591);
    var$2[125] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(154);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12592, 12687);
    var$2[126] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(155);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12688, 12703);
    var$2[127] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(156);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12704, 12735);
    var$2[128] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(157);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12736, 12783);
    var$2[129] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(158);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12784, 12799);
    var$2[130] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(159);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(12800, 13055);
    var$2[131] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(160);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(13056, 13311);
    var$2[132] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(161);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(13312, 19893);
    var$2[133] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(162);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(19904, 19967);
    var$2[134] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(163);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(19968, 40959);
    var$2[135] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(164);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(40960, 42127);
    var$2[136] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(165);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(42128, 42191);
    var$2[137] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(166);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(42752, 42783);
    var$2[138] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(167);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(43008, 43055);
    var$2[139] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(168);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(44032, 55203);
    var$2[140] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(169);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(55296, 56191);
    var$2[141] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(170);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(56192, 56319);
    var$2[142] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(171);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(56320, 57343);
    var$2[143] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(172);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(57344, 63743);
    var$2[144] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(173);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(63744, 64255);
    var$2[145] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(174);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(64256, 64335);
    var$2[146] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(175);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(64336, 65023);
    var$2[147] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(176);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(65024, 65039);
    var$2[148] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(177);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(65040, 65055);
    var$2[149] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(178);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(65056, 65071);
    var$2[150] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(179);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(65072, 65103);
    var$2[151] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(180);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(65104, 65135);
    var$2[152] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(181);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(65136, 65279);
    var$2[153] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(182);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(65280, 65519);
    var$2[154] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(183);
    var$4[1] = jur_AbstractCharClass$LazyRange__init_(0, 1114111);
    var$2[155] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(184);
    var$4[1] = jur_AbstractCharClass$LazySpecialsBlock__init_0();
    var$2[156] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(185);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(0, 1);
    var$2[157] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(186);
    var$4[1] = jur_AbstractCharClass$LazyCategoryScope__init_(62, 1);
    var$2[158] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(187);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(1, 1);
    var$2[159] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(188);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(2, 1);
    var$2[160] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(189);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(3, 0);
    var$2[161] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(190);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(4, 0);
    var$2[162] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(191);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(5, 1);
    var$2[163] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(192);
    var$4[1] = jur_AbstractCharClass$LazyCategoryScope__init_(448, 1);
    var$2[164] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(193);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(6, 1);
    var$2[165] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(194);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(7, 0);
    var$2[166] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(195);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(8, 1);
    var$2[167] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(196);
    var$4[1] = jur_AbstractCharClass$LazyCategoryScope__init_(3584, 1);
    var$2[168] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(197);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(9, 1);
    var$2[169] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(198);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(10, 1);
    var$2[170] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(199);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(11, 1);
    var$2[171] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(200);
    var$4[1] = jur_AbstractCharClass$LazyCategoryScope__init_(28672, 0);
    var$2[172] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(201);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(12, 0);
    var$2[173] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(202);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(13, 0);
    var$2[174] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(203);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(14, 0);
    var$2[175] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(204);
    var$4[1] = jur_AbstractCharClass$LazyCategoryScope__init_2(983040, 1, 1);
    var$2[176] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(205);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(15, 0);
    var$2[177] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(206);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(16, 1);
    var$2[178] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(207);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(18, 1);
    var$2[179] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(208);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_2(19, 0, 1);
    var$2[180] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(209);
    var$4[1] = jur_AbstractCharClass$LazyCategoryScope__init_(1643118592, 1);
    var$2[181] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(210);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(20, 0);
    var$2[182] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(211);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(21, 0);
    var$2[183] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(212);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(22, 0);
    var$2[184] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(213);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(23, 0);
    var$2[185] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(214);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(24, 1);
    var$2[186] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(215);
    var$4[1] = jur_AbstractCharClass$LazyCategoryScope__init_(2113929216, 1);
    var$2[187] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(216);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(25, 1);
    var$2[188] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(217);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(26, 0);
    var$2[189] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(218);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(27, 0);
    var$2[190] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(219);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(28, 1);
    var$2[191] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(220);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(29, 0);
    var$2[192] = var$3;
    var$3 = $rt_createArray(jl_Object, 2);
    var$4 = var$3.data;
    var$4[0] = $rt_s(221);
    var$4[1] = jur_AbstractCharClass$LazyCategory__init_(30, 0);
    var$2[193] = var$3;
    jur_AbstractCharClass$PredefinedCharacterClasses_contents = var$1;
};
function owts_Puzzle() {
    let a = this; jl_Object.call(a);
    a.$wcaMinScrambleDistance = 0;
    a.$r = null;
}
let owts_Puzzle_l = null,
owts_Puzzle_$assertionsDisabled = 0,
owts_Puzzle_$callClinit = () => {
    owts_Puzzle_$callClinit = $rt_eraseClinit(owts_Puzzle);
    owts_Puzzle__clinit_();
},
owts_Puzzle__init_ = $this => {
    owts_Puzzle_$callClinit();
    jl_Object__init_($this);
    $this.$wcaMinScrambleDistance = 2;
    $this.$r = null;
},
owts_Puzzle_generateWcaScramble = ($this, $r) => {
    let $psag;
    while (true) {
        $psag = $this.$generateRandomMoves($r);
        if ($psag.$state.$solveIn1($this.$wcaMinScrambleDistance - 1 | 0) !== null)
            continue;
        else
            break;
    }
    return $psag.$generator;
},
owts_Puzzle_solveIn = ($this, $ps, $n) => {
    let $seenSolved, $fringeSolved, $seenScrambled, $fringeScrambled, $bestIntersectionCost, $bestIntersection, $solvedNormalized, $fringeTies, $minFringeScrambled, $minFringeSolved, var$13, var$14, $extendSolved, var$16, var$17, var$18, $minComparingFringe, $node, $distance, $cost, $bestPossibleSolution, $movesByState, var$25, $next, $moveCost, $nextDistance, $distanceFromScrambled, $linkedStates, var$31, var$32, $solution, $distanceFromSolved, $nextState, $nextStateNormalized, $moveName, $distanceFromSolved_0,
    $e, $newDistanceFromScrambled, $$je;
    if ($ps.$isSolved())
        return $rt_s(3);
    $seenSolved = ju_HashMap__init_();
    $fringeSolved = owts_Puzzle$SortedBuckets__init_();
    $seenScrambled = ju_HashMap__init_();
    $fringeScrambled = owts_Puzzle$SortedBuckets__init_();
    $bestIntersectionCost = $n + 1 | 0;
    $bestIntersection = null;
    $solvedNormalized = ($this.$getSolvedState()).$getNormalized();
    $fringeSolved.$add3($solvedNormalized, 0);
    $seenSolved.$put($solvedNormalized, jl_Integer_valueOf(0));
    $fringeScrambled.$add3($ps.$getNormalized(), 0);
    $seenScrambled.$put($ps.$getNormalized(), jl_Integer_valueOf(0));
    $fringeTies = 0;
    $minFringeScrambled = (-1);
    $minFringeSolved = (-1);
    var$13 = $bestIntersectionCost;
    while (!($fringeSolved.$isEmpty() && $fringeScrambled.$isEmpty())) {
        if (!$fringeScrambled.$isEmpty())
            $minFringeScrambled = $fringeScrambled.$smallestValue();
        if (!$fringeSolved.$isEmpty())
            $minFringeSolved = $fringeSolved.$smallestValue();
        if (!$fringeSolved.$isEmpty() && !$fringeScrambled.$isEmpty()) {
            var$14 = $rt_compare($minFringeSolved, $minFringeScrambled);
            if (var$14 < 0)
                $extendSolved = 1;
            else if (var$14 > 0)
                $extendSolved = 0;
            else {
                var$14 = $fringeTies + 1 | 0;
                $extendSolved = $fringeTies % 2 | 0 ? 0 : 1;
                $fringeTies = var$14;
            }
        } else
            $extendSolved = $fringeSolved.$isEmpty() ? 0 : 1;
        if (!$extendSolved) {
            var$16 = $seenScrambled;
            var$17 = $fringeScrambled;
            var$18 = $seenSolved;
            $minComparingFringe = $minFringeSolved;
        } else {
            var$16 = $seenSolved;
            var$17 = $fringeSolved;
            var$18 = $seenScrambled;
            $minComparingFringe = $minFringeScrambled;
        }
        $node = var$17.$pop();
        $distance = (var$16.$get($node)).$intValue();
        if (var$18.$containsKey($node)) {
            $cost = (var$18.$get($node)).$intValue() + $distance | 0;
            if ($cost >= var$13)
                continue;
            $bestIntersection = $node;
            var$13 = $cost;
            continue;
        }
        $bestPossibleSolution = $distance + $minComparingFringe | 0;
        if ($bestPossibleSolution >= var$13)
            continue;
        if ($distance >= ($bestIntersectionCost / 2 | 0))
            continue;
        $movesByState = $node.$getCanonicalMovesByState();
        var$25 = ($movesByState.$keySet()).$iterator();
        while (var$25.$hasNext()) {
            $next = var$25.$next();
            $moveCost = $node.$getMoveCost($movesByState.$get($next));
            $nextDistance = $distance + $moveCost | 0;
            var$18 = $next.$getNormalized();
            if (var$16.$containsKey(var$18) && $nextDistance >= (var$16.$get(var$18)).$intValue())
                continue;
            var$17.$add3(var$18, $nextDistance);
            var$16.$put(var$18, jl_Integer_valueOf($nextDistance));
        }
    }
    if ($bestIntersection === null)
        return null;
    if (!owts_Puzzle_$assertionsDisabled && !$bestIntersection.$isNormalized())
        $rt_throw(jl_AssertionError__init_());
    $distanceFromScrambled = ($seenScrambled.$get($bestIntersection)).$intValue();
    $linkedStates = $rt_createArray(owts_Puzzle$PuzzleState, $distanceFromScrambled + 1 | 0);
    var$31 = $linkedStates.data;
    var$31[$distanceFromScrambled] = $bestIntersection;
    var$32 = $bestIntersection;
    a: while (true) {
        if ($distanceFromScrambled <= 0) {
            $solution = new owts_AlgorithmBuilder;
            owts_AlgorithmBuilder$MergingMode_$callClinit();
            owts_AlgorithmBuilder__init_0($solution, owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES, $ps);
            var$14 = 0;
            b: while (true) {
                if ($ps.$equalsNormalized($bestIntersection)) {
                    $distanceFromSolved = ($seenSolved.$get($ps.$getNormalized())).$intValue();
                    c: while ($distanceFromSolved > 0) {
                        var$16 = (($ps.$getCanonicalMovesByState()).$entrySet()).$iterator();
                        d: {
                            while (var$16.$hasNext()) {
                                $next = var$16.$next();
                                $nextState = $next.$getKey();
                                $nextStateNormalized = $nextState.$getNormalized();
                                $moveName = $next.$getValue();
                                if ($seenSolved.$containsKey($nextStateNormalized)) {
                                    $distanceFromSolved_0 = ($seenSolved.$get($nextStateNormalized)).$intValue();
                                    if ($distanceFromSolved_0 < $distanceFromSolved)
                                        break d;
                                }
                            }
                            if (!owts_Puzzle_$assertionsDisabled)
                                $rt_throw(jl_AssertionError__init_());
                            continue c;
                        }
                        try {
                            $solution.$appendMove($moveName);
                            $ps = $nextState;
                            $distanceFromSolved = $distanceFromSolved_0;
                            continue;
                        } catch ($$e) {
                            $$je = $rt_wrapException($$e);
                            if ($$je instanceof owts_InvalidMoveException) {
                                $e = $$je;
                                $rt_throw(jl_RuntimeException__init_1($e));
                            } else {
                                throw $$e;
                            }
                        }
                    }
                    return $solution.$toString();
                }
                var$16 = (($ps.$getCanonicalMovesByState()).$entrySet()).$iterator();
                e: {
                    while (var$16.$hasNext()) {
                        $next = var$16.$next();
                        $nextState = $next.$getKey();
                        $moveName = $next.$getValue();
                        if ($nextState.$equalsNormalized(var$31[var$14 + 1 | 0]))
                            break e;
                    }
                    if (!owts_Puzzle_$assertionsDisabled)
                        break b;
                    continue b;
                }
                try {
                    $solution.$appendMove($moveName);
                } catch ($$e) {
                    $$je = $rt_wrapException($$e);
                    if ($$je instanceof owts_InvalidMoveException) {
                        $e = $$je;
                        $rt_throw(jl_RuntimeException__init_1($e));
                    } else {
                        throw $$e;
                    }
                }
                var$14 = ($seenScrambled.$get($nextState.$getNormalized())).$intValue();
                $ps = $nextState;
            }
            $rt_throw(jl_AssertionError__init_());
        }
        var$16 = ((var$32.$getCanonicalMovesByState()).$keySet()).$iterator();
        f: {
            while (true) {
                if (!var$16.$hasNext())
                    break f;
                $next = var$16.$next();
                var$17 = $next.$getNormalized();
                if ($seenScrambled.$containsKey(var$17)) {
                    $newDistanceFromScrambled = ($seenScrambled.$get(var$17)).$intValue();
                    if ($newDistanceFromScrambled < $distanceFromScrambled)
                        break;
                }
            }
            var$31[$newDistanceFromScrambled] = var$17;
            var$32 = var$17;
            $distanceFromScrambled = $newDistanceFromScrambled;
            continue a;
        }
        if (!owts_Puzzle_$assertionsDisabled)
            break;
    }
    $rt_throw(jl_AssertionError__init_());
},
owts_Puzzle_deepCopy = ($src, $dest) => {
    let $i, var$4, var$5;
    owts_Puzzle_$callClinit();
    $i = 0;
    while (true) {
        var$4 = $src.data;
        if ($i >= var$4.length)
            break;
        var$5 = $dest.data;
        jl_System_fastArraycopy(var$4[$i], 0, var$5[$i], 0, var$4[$i].data.length);
        $i = $i + 1 | 0;
    }
},
owts_Puzzle_deepCopy0 = ($src, $dest) => {
    let $i, var$4, var$5;
    owts_Puzzle_$callClinit();
    $i = 0;
    while (true) {
        var$4 = $src.data;
        if ($i >= var$4.length)
            break;
        var$5 = $dest.data;
        owts_Puzzle_deepCopy(var$4[$i], var$5[$i]);
        $i = $i + 1 | 0;
    }
},
owts_Puzzle__clinit_ = () => {
    owts_Puzzle_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owts_Puzzle)) ? 0 : 1;
    owts_Puzzle_l = jul_Logger_getLogger(jl_Class_getName($rt_cls(owts_Puzzle)));
};
function owtp_PyraminxPuzzle() {
    owts_Puzzle.call(this);
    this.$pyraminxSolver = null;
}
let owtp_PyraminxPuzzle_l = null,
owtp_PyraminxPuzzle_defaultColorScheme = null,
owtp_PyraminxPuzzle_$assertionsDisabled = 0,
owtp_PyraminxPuzzle_$callClinit = () => {
    owtp_PyraminxPuzzle_$callClinit = $rt_eraseClinit(owtp_PyraminxPuzzle);
    owtp_PyraminxPuzzle__clinit_();
},
owtp_PyraminxPuzzle__init_ = $this => {
    owtp_PyraminxPuzzle_$callClinit();
    owts_Puzzle__init_($this);
    $this.$pyraminxSolver = owtp_PyraminxSolver__init_0();
    $this.$wcaMinScrambleDistance = 6;
},
owtp_PyraminxPuzzle__init_0 = () => {
    let var_0 = new owtp_PyraminxPuzzle();
    owtp_PyraminxPuzzle__init_(var_0);
    return var_0;
},
owtp_PyraminxPuzzle_generateRandomMoves = ($this, $r) => {
    let $state, $scramble, $pState, $e, $$je;
    $state = $this.$pyraminxSolver.$randomState($r);
    $scramble = $this.$pyraminxSolver.$generateExactly($state, 11, 0);
    owtp_PyraminxPuzzle_$callClinit();
    if (!owtp_PyraminxPuzzle_$assertionsDisabled && ($scramble.$split($rt_s(16))).data.length != (11 + $state.$unsolvedTips() | 0))
        $rt_throw(jl_AssertionError__init_());
    a: {
        try {
            $pState = ($this.$getSolvedState()).$applyAlgorithm($scramble);
            break a;
        } catch ($$e) {
            $$je = $rt_wrapException($$e);
            if ($$je instanceof owts_InvalidScrambleException) {
                $e = $$je;
            } else {
                throw $$e;
            }
        }
        $rt_throw(jl_RuntimeException__init_1($e));
    }
    return owts_PuzzleStateAndGenerator__init_($pState, $scramble);
},
owtp_PyraminxPuzzle_getSolvedState = $this => {
    return owtp_PyraminxPuzzle$PyraminxState__init_2($this);
},
owtp_PyraminxPuzzle_access$000 = $x0 => {
    owtp_PyraminxPuzzle_$callClinit();
    return $x0.$pyraminxSolver;
},
owtp_PyraminxPuzzle__clinit_ = () => {
    owtp_PyraminxPuzzle_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_PyraminxPuzzle)) ? 0 : 1;
    owtp_PyraminxPuzzle_l = jul_Logger_getLogger(jl_Class_getName($rt_cls(owtp_PyraminxPuzzle)));
    owtp_PyraminxPuzzle_defaultColorScheme = ju_HashMap__init_();
    owtp_PyraminxPuzzle_defaultColorScheme.$put($rt_s(23), owts_Color__init_0(65280));
    owtp_PyraminxPuzzle_defaultColorScheme.$put($rt_s(62), owts_Color__init_0(16776960));
    owtp_PyraminxPuzzle_defaultColorScheme.$put($rt_s(222), owts_Color__init_0(16711680));
    owtp_PyraminxPuzzle_defaultColorScheme.$put($rt_s(20), owts_Color__init_0(255));
},
jur_AbstractCharClass$LazyJavaLetter = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaLetter__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaLetter__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaLetter();
    jur_AbstractCharClass$LazyJavaLetter__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaLetter_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaLetter$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function jur_DecomposedCharSet() {
    let a = this; jur_JointSet.call(a);
    a.$readCharsForCodePoint = 0;
    a.$decomposedCharUTF160 = null;
    a.$decomposedChar0 = null;
    a.$decomposedCharLength0 = 0;
}
let jur_DecomposedCharSet__init_ = ($this, $decomposedChar, $decomposedCharLength) => {
    jur_JointSet__init_($this);
    $this.$readCharsForCodePoint = 1;
    $this.$decomposedChar0 = $decomposedChar;
    $this.$decomposedCharLength0 = $decomposedCharLength;
},
jur_DecomposedCharSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_DecomposedCharSet();
    jur_DecomposedCharSet__init_(var_2, var_0, var_1);
    return var_2;
},
jur_DecomposedCharSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_DecomposedCharSet_matches = ($this, $strIndex, $testString, $matchResult) => {
    let $decCodePoint, $readCodePoints, $rightBound, $curChar, var$8, $decCurCodePoint, var$10, var$11, var$12, var$13, var$14, var$15;
    $decCodePoint = $rt_createIntArray(4);
    $readCodePoints = 0;
    $rightBound = $matchResult.$getRightBound();
    if ($strIndex >= $rightBound)
        return (-1);
    $curChar = $this.$codePointAt($strIndex, $testString, $rightBound);
    var$8 = $strIndex + $this.$readCharsForCodePoint | 0;
    $decCurCodePoint = jur_Lexer_getDecomposition($curChar);
    if ($decCurCodePoint === null) {
        var$10 = $decCodePoint.data;
        var$11 = 1;
        var$10[$readCodePoints] = $curChar;
    } else {
        var$11 = $decCurCodePoint.data.length;
        jl_System_fastArraycopy($decCurCodePoint, 0, $decCodePoint, 0, var$11);
        var$11 = $readCodePoints + var$11 | 0;
    }
    a: {
        if (var$8 < $rightBound) {
            var$12 = $this.$codePointAt(var$8, $testString, $rightBound);
            while (var$11 < 4) {
                if (!jur_Lexer_hasDecompositionNonNullCanClass(var$12)) {
                    var$10 = $decCodePoint.data;
                    var$13 = var$11 + 1 | 0;
                    var$10[var$11] = var$12;
                } else {
                    var$10 = (jur_Lexer_getDecomposition(var$12)).data;
                    if (var$10.length != 2) {
                        var$14 = $decCodePoint.data;
                        var$13 = var$11 + 1 | 0;
                        var$14[var$11] = var$10[0];
                    } else {
                        var$14 = $decCodePoint.data;
                        var$12 = var$11 + 1 | 0;
                        var$14[var$11] = var$10[0];
                        var$13 = var$12 + 1 | 0;
                        var$14[var$12] = var$10[1];
                    }
                }
                var$8 = var$8 + $this.$readCharsForCodePoint | 0;
                if (var$8 >= $rightBound) {
                    var$11 = var$13;
                    break a;
                }
                var$12 = $this.$codePointAt(var$8, $testString, $rightBound);
                var$11 = var$13;
            }
        }
    }
    if (var$11 != $this.$decomposedCharLength0)
        return (-1);
    var$15 = 0;
    while (true) {
        if (var$15 >= var$11)
            return $this.$next3.$matches(var$8, $testString, $matchResult);
        if ($decCodePoint.data[var$15] != $this.$decomposedChar0.data[var$15])
            break;
        var$15 = var$15 + 1 | 0;
    }
    return (-1);
},
jur_DecomposedCharSet_getDecomposedChar = $this => {
    let $strBuff, $i;
    if ($this.$decomposedCharUTF160 === null) {
        $strBuff = jl_StringBuilder__init_();
        $i = 0;
        while ($i < $this.$decomposedCharLength0) {
            $strBuff.$append4(jl_Character_toChars($this.$decomposedChar0.data[$i]));
            $i = $i + 1 | 0;
        }
        $this.$decomposedCharUTF160 = $strBuff.$toString();
    }
    return $this.$decomposedCharUTF160;
},
jur_DecomposedCharSet_codePointAt = ($this, $strIndex, $testString, $rightBound) => {
    let $curChar, var$5, $low, $curCodePointUTF16;
    $this.$readCharsForCodePoint = 1;
    if ($strIndex >= ($rightBound - 1 | 0))
        $curChar = $testString.$charAt($strIndex);
    else {
        var$5 = $strIndex + 1 | 0;
        $curChar = $testString.$charAt($strIndex);
        $low = $testString.$charAt(var$5);
        if (jl_Character_isSurrogatePair($curChar, $low)) {
            $curCodePointUTF16 = $rt_createCharArrayFromData([$curChar, $low]);
            $curChar = jl_Character_codePointAt($curCodePointUTF16, 0);
            $this.$readCharsForCodePoint = 2;
        }
    }
    return $curChar;
},
jur_DecomposedCharSet_first = ($this, $set) => {
    let var$2, var$3;
    a: {
        if ($set instanceof jur_DecomposedCharSet) {
            var$2 = $set;
            if (!(jur_DecomposedCharSet_getDecomposedChar(var$2)).$equals(jur_DecomposedCharSet_getDecomposedChar($this))) {
                var$3 = 0;
                break a;
            }
        }
        var$3 = 1;
    }
    return var$3;
},
jur_DecomposedCharSet_hasConsumed = ($this, $matchResult) => {
    return 1;
},
jur_CIDecomposedCharSet = $rt_classWithoutFields(jur_DecomposedCharSet),
jur_CIDecomposedCharSet__init_ = ($this, $decomp, $decomposedCharLength) => {
    jur_DecomposedCharSet__init_($this, $decomp, $decomposedCharLength);
},
jur_CIDecomposedCharSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_CIDecomposedCharSet();
    jur_CIDecomposedCharSet__init_(var_2, var_0, var_1);
    return var_2;
};
function ju_MapEntry() {
    let a = this; jl_Object.call(a);
    a.$key = null;
    a.$value = null;
}
let ju_MapEntry__init_ = ($this, $theKey, $theValue) => {
    jl_Object__init_($this);
    $this.$key = $theKey;
    $this.$value = $theValue;
},
ju_MapEntry__init_0 = (var_0, var_1) => {
    let var_2 = new ju_MapEntry();
    ju_MapEntry__init_(var_2, var_0, var_1);
    return var_2;
},
ju_MapEntry_getKey = $this => {
    return $this.$key;
},
ju_MapEntry_getValue = $this => {
    return $this.$value;
};
function ju_HashMap$HashEntry() {
    let a = this; ju_MapEntry.call(a);
    a.$origKeyHash = 0;
    a.$next4 = null;
}
let ju_HashMap$HashEntry__init_ = ($this, $theKey, $hash) => {
    ju_MapEntry__init_($this, $theKey, null);
    $this.$origKeyHash = $hash;
},
ju_HashMap$HashEntry__init_0 = (var_0, var_1) => {
    let var_2 = new ju_HashMap$HashEntry();
    ju_HashMap$HashEntry__init_(var_2, var_0, var_1);
    return var_2;
};
function ju_LinkedHashMap$LinkedHashMapEntry() {
    let a = this; ju_HashMap$HashEntry.call(a);
    a.$chainForward = null;
    a.$chainBackward = null;
}
let ju_LinkedHashMap$LinkedHashMapEntry__init_ = ($this, $theKey, $hash) => {
    ju_HashMap$HashEntry__init_($this, $theKey, $hash);
    $this.$chainForward = null;
    $this.$chainBackward = null;
},
ju_LinkedHashMap$LinkedHashMapEntry__init_0 = (var_0, var_1) => {
    let var_2 = new ju_LinkedHashMap$LinkedHashMapEntry();
    ju_LinkedHashMap$LinkedHashMapEntry__init_(var_2, var_0, var_1);
    return var_2;
},
jur_AheadFSet = $rt_classWithoutFields(jur_FSet),
jur_AheadFSet__init_ = $this => {
    jur_FSet__init_($this, (-1));
},
jur_AheadFSet__init_0 = () => {
    let var_0 = new jur_AheadFSet();
    jur_AheadFSet__init_(var_0);
    return var_0;
},
jur_AheadFSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    return $stringIndex;
},
otci_RandomUtils = $rt_classWithoutFields(),
otci_RandomUtils_checkBound = $bound => {
    if ($bound > 0)
        return;
    $rt_throw(jl_IllegalArgumentException__init_());
},
jur_AbstractCharClass$LazyASCII = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyASCII__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyASCII__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyASCII();
    jur_AbstractCharClass$LazyASCII__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyASCII_computeValue = $this => {
    return (jur_CharClass__init_()).$add1(0, 127);
},
jur_NonCapJointSet = $rt_classWithoutFields(jur_JointSet),
jur_NonCapJointSet__init_ = ($this, $children, $fSet) => {
    jur_JointSet__init_0($this, $children, $fSet);
},
jur_NonCapJointSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_NonCapJointSet();
    jur_NonCapJointSet__init_(var_2, var_0, var_1);
    return var_2;
},
jur_NonCapJointSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $start, $size, $i, $e, $shift;
    $start = $matchResult.$getConsumed($this.$groupIndex);
    $matchResult.$setConsumed($this.$groupIndex, $stringIndex);
    $size = $this.$children.$size();
    $i = 0;
    while (true) {
        if ($i >= $size) {
            $matchResult.$setConsumed($this.$groupIndex, $start);
            return (-1);
        }
        $e = $this.$children.$get0($i);
        $shift = $e.$matches($stringIndex, $testString, $matchResult);
        if ($shift >= 0)
            break;
        $i = $i + 1 | 0;
    }
    return $shift;
},
jur_NonCapJointSet_hasConsumed = ($this, $matchResult) => {
    let $cons;
    $cons = $matchResult.$getConsumed($this.$groupIndex);
    return !$cons ? 0 : 1;
},
jur_AtomicJointSet = $rt_classWithoutFields(jur_NonCapJointSet),
jur_AtomicJointSet__init_ = ($this, $children, $fSet) => {
    jur_NonCapJointSet__init_($this, $children, $fSet);
},
jur_AtomicJointSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_AtomicJointSet();
    jur_AtomicJointSet__init_(var_2, var_0, var_1);
    return var_2;
},
jur_AtomicJointSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $start, $size, $i, $e, $shift;
    $start = $matchResult.$getConsumed($this.$groupIndex);
    $matchResult.$setConsumed($this.$groupIndex, $stringIndex);
    $size = $this.$children.$size();
    $i = 0;
    while ($i < $size) {
        $e = $this.$children.$get0($i);
        $shift = $e.$matches($stringIndex, $testString, $matchResult);
        if ($shift >= 0)
            return $this.$next3.$matches($this.$fSet.$getIndex(), $testString, $matchResult);
        $i = $i + 1 | 0;
    }
    $matchResult.$setConsumed($this.$groupIndex, $start);
    return (-1);
},
jur_AtomicJointSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_PositiveLookAhead = $rt_classWithoutFields(jur_AtomicJointSet),
jur_PositiveLookAhead__init_ = ($this, $children, $fSet) => {
    jur_AtomicJointSet__init_($this, $children, $fSet);
},
jur_PositiveLookAhead__init_0 = (var_0, var_1) => {
    let var_2 = new jur_PositiveLookAhead();
    jur_PositiveLookAhead__init_(var_2, var_0, var_1);
    return var_2;
},
jur_PositiveLookAhead_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $size, $i, $e, $shift;
    $size = $this.$children.$size();
    $i = 0;
    while ($i < $size) {
        $e = $this.$children.$get0($i);
        $shift = $e.$matches($stringIndex, $testString, $matchResult);
        if ($shift >= 0)
            return $this.$next3.$matches($stringIndex, $testString, $matchResult);
        $i = $i + 1 | 0;
    }
    return (-1);
},
jur_PositiveLookAhead_hasConsumed = ($this, $matchResult) => {
    return 0;
},
jur_NegativeLookAhead = $rt_classWithoutFields(jur_AtomicJointSet),
jur_NegativeLookAhead__init_ = ($this, $children, $fSet) => {
    jur_AtomicJointSet__init_($this, $children, $fSet);
},
jur_NegativeLookAhead__init_0 = (var_0, var_1) => {
    let var_2 = new jur_NegativeLookAhead();
    jur_NegativeLookAhead__init_(var_2, var_0, var_1);
    return var_2;
},
jur_NegativeLookAhead_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $size, $i, $e;
    $size = $this.$children.$size();
    $i = 0;
    while (true) {
        if ($i >= $size)
            return $this.$next3.$matches($stringIndex, $testString, $matchResult);
        $e = $this.$children.$get0($i);
        if ($e.$matches($stringIndex, $testString, $matchResult) >= 0)
            break;
        $i = $i + 1 | 0;
    }
    return (-1);
},
jur_NegativeLookAhead_hasConsumed = ($this, $matchResult) => {
    return 0;
};
function ju_TreeMap() {
    let a = this; ju_AbstractMap.call(a);
    a.$root = null;
    a.$comparator = null;
    a.$originalComparator = null;
    a.$revertedComparator = null;
    a.$modCount2 = 0;
}
let ju_TreeMap__init_0 = $this => {
    ju_TreeMap__init_($this, null);
},
ju_TreeMap__init_1 = () => {
    let var_0 = new ju_TreeMap();
    ju_TreeMap__init_0(var_0);
    return var_0;
},
ju_TreeMap__init_ = ($this, $comparator) => {
    ju_AbstractMap__init_($this);
    $this.$originalComparator = $comparator;
    if ($comparator === null)
        $comparator = ju_Comparator$NaturalOrder_instance();
    $this.$comparator = $comparator;
},
ju_TreeMap__init_2 = var_0 => {
    let var_1 = new ju_TreeMap();
    ju_TreeMap__init_(var_1, var_0);
    return var_1;
},
ju_TreeMap_ensureRevertedComparator = $this => {
    if ($this.$revertedComparator === null)
        $this.$revertedComparator = ju_TreeMap$ensureRevertedComparator$lambda$_5_0__init_0($this);
},
ju_TreeMap_put = ($this, $key, $value) => {
    let $node, $old;
    $this.$root = ju_TreeMap_getOrCreateNode($this, $this.$root, $key);
    $node = $this.$findExact($key);
    $old = $node.$setValue($value);
    $node.$setValue($value);
    $this.$modCount2 = $this.$modCount2 + 1 | 0;
    return $old;
},
ju_TreeMap_remove = ($this, $key) => {
    let $node;
    $node = $this.$findExact($key);
    if ($node === null)
        return null;
    $this.$root = ju_TreeMap_deleteNode($this, $this.$root, $key);
    $this.$modCount2 = $this.$modCount2 + 1 | 0;
    return $node.$getValue();
},
ju_TreeMap_containsKey = ($this, $key) => {
    return $this.$findExact($key) === null ? 0 : 1;
},
ju_TreeMap_findExact = ($this, $key) => {
    let $node, $cmp;
    $node = $this.$root;
    $this.$comparator.$compare($key, $key);
    while (true) {
        if ($node === null)
            return null;
        $cmp = $this.$comparator.$compare($key, $node.$getKey());
        if (!$cmp)
            break;
        $node = $cmp >= 0 ? $node.$right : $node.$left;
    }
    return $node;
},
ju_TreeMap_findExactOrNext = ($this, $key, $reverse) => {
    let $node, $lastForward, $cmp, var$6;
    $node = $this.$root;
    $lastForward = null;
    while ($node !== null) {
        $cmp = $this.$comparator.$compare($key, $node.$getKey());
        if ($reverse)
            $cmp =  -$cmp | 0;
        if (!$cmp)
            return $node;
        if ($cmp >= 0)
            var$6 = $node.$down($reverse);
        else {
            var$6 = $node.$forward($reverse);
            $lastForward = $node;
        }
        $node = var$6;
    }
    return $lastForward;
},
ju_TreeMap_findNext = ($this, $key, $reverse) => {
    let $node, $lastForward, $cmp, var$6;
    $node = $this.$root;
    $lastForward = null;
    while ($node !== null) {
        $cmp = $this.$comparator.$compare($key, $node.$getKey());
        if ($reverse)
            $cmp =  -$cmp | 0;
        if ($cmp >= 0)
            var$6 = $node.$down($reverse);
        else {
            var$6 = $node.$forward($reverse);
            $lastForward = $node;
        }
        $node = var$6;
    }
    return $lastForward;
},
ju_TreeMap_getOrCreateNode = ($this, $root, $key) => {
    let $cmp;
    if ($root === null)
        return ju_TreeMap$TreeNode__init_0($key);
    $cmp = $this.$comparator.$compare($key, $root.$getKey());
    if (!$cmp)
        return $root;
    if ($cmp >= 0)
        $root.$right = ju_TreeMap_getOrCreateNode($this, $root.$right, $key);
    else
        $root.$left = ju_TreeMap_getOrCreateNode($this, $root.$left, $key);
    $root.$fix();
    return $root.$balance();
},
ju_TreeMap_deleteNode = ($this, $right, $key) => {
    let $cmp, $left, $pathToMin, $minDepth, var$7, $minDepth_0, var$9, $node;
    if ($right === null)
        return null;
    $cmp = $this.$comparator.$compare($key, $right.$getKey());
    if ($cmp < 0)
        $right.$left = ju_TreeMap_deleteNode($this, $right.$left, $key);
    else if ($cmp > 0)
        $right.$right = ju_TreeMap_deleteNode($this, $right.$right, $key);
    else {
        if ($right.$right === null)
            return $right.$left;
        $left = $right.$left;
        $right = $right.$right;
        $pathToMin = $rt_createArray(ju_TreeMap$TreeNode, $right.$height);
        $minDepth = 0;
        while ($right.$left !== null) {
            var$7 = $pathToMin.data;
            $minDepth_0 = $minDepth + 1 | 0;
            var$7[$minDepth] = $right;
            $right = $right.$left;
            $minDepth = $minDepth_0;
        }
        var$9 = $right.$right;
        while ($minDepth > 0) {
            var$7 = $pathToMin.data;
            $minDepth = $minDepth + (-1) | 0;
            $node = var$7[$minDepth];
            $node.$left = var$9;
            $node.$fix();
            var$9 = $node.$balance();
        }
        $right.$right = var$9;
        $right.$left = $left;
        $right.$fix();
    }
    $right.$fix();
    return $right.$balance();
},
ju_TreeMap_firstKey = $this => {
    let $node;
    $node = ju_TreeMap_firstNode($this, 0);
    if ($node !== null)
        return $node.$getKey();
    $rt_throw(ju_NoSuchElementException__init_());
},
ju_TreeMap_tailMap = ($this, $fromKey, $inclusive) => {
    return ju_TreeMap$MapView__init_0($this, $fromKey, $inclusive, 1, null, 0, 0, 0);
},
ju_TreeMap_firstNode = ($this, $reverse) => {
    let $prev, $prev_0, var$4;
    $prev = $this.$root;
    $prev_0 = null;
    while ($prev !== null) {
        var$4 = $prev.$forward($reverse);
        $prev_0 = $prev;
        $prev = var$4;
    }
    return $prev_0;
},
ju_TreeMap_size = $this => {
    return $this.$root === null ? 0 : $this.$root.$size2;
},
ju_Iterator = $rt_classWithoutFields(0);
function ju_AbstractList$1() {
    let a = this; jl_Object.call(a);
    a.$index1 = 0;
    a.$modCount3 = 0;
    a.$size4 = 0;
    a.$removeIndex = 0;
    a.$this$00 = null;
}
let ju_AbstractList$1__init_ = ($this, $this$0) => {
    $this.$this$00 = $this$0;
    jl_Object__init_($this);
    $this.$modCount3 = $this.$this$00.$modCount;
    $this.$size4 = $this.$this$00.$size();
    $this.$removeIndex = (-1);
},
ju_AbstractList$1__init_0 = var_0 => {
    let var_1 = new ju_AbstractList$1();
    ju_AbstractList$1__init_(var_1, var_0);
    return var_1;
},
ju_AbstractList$1_hasNext = $this => {
    return $this.$index1 >= $this.$size4 ? 0 : 1;
},
ju_AbstractList$1_next = $this => {
    let var$1, var$2;
    ju_AbstractList$1_checkConcurrentModification($this);
    $this.$removeIndex = $this.$index1;
    var$1 = $this.$this$00;
    var$2 = $this.$index1;
    $this.$index1 = var$2 + 1 | 0;
    return var$1.$get0(var$2);
},
ju_AbstractList$1_checkConcurrentModification = $this => {
    if ($this.$modCount3 == $this.$this$00.$modCount)
        return;
    $rt_throw(ju_ConcurrentModificationException__init_());
};
function ju_AbstractMap$SimpleEntry() {
    let a = this; jl_Object.call(a);
    a.$key0 = null;
    a.$value2 = null;
}
let ju_AbstractMap$SimpleEntry__init_ = ($this, $key, $value) => {
    jl_Object__init_($this);
    $this.$key0 = $key;
    $this.$value2 = $value;
},
ju_AbstractMap$SimpleEntry__init_0 = (var_0, var_1) => {
    let var_2 = new ju_AbstractMap$SimpleEntry();
    ju_AbstractMap$SimpleEntry__init_(var_2, var_0, var_1);
    return var_2;
},
ju_AbstractMap$SimpleEntry_getValue = $this => {
    return $this.$value2;
},
ju_AbstractMap$SimpleEntry_setValue = ($this, $value) => {
    let $old;
    $old = $this.$value2;
    $this.$value2 = $value;
    return $old;
},
ju_AbstractMap$SimpleEntry_getKey = $this => {
    return $this.$key0;
};
function owtp_CubePuzzle() {
    owts_Puzzle.call(this);
    this.$size0 = 0;
}
let owtp_CubePuzzle_DIR_TO_STR = null,
owtp_CubePuzzle_faceRotationsByName = null,
owtp_CubePuzzle_DEFAULT_LENGTHS = null,
owtp_CubePuzzle_defaultColorScheme = null,
owtp_CubePuzzle_$assertionsDisabled = 0,
owtp_CubePuzzle_$callClinit = () => {
    owtp_CubePuzzle_$callClinit = $rt_eraseClinit(owtp_CubePuzzle);
    owtp_CubePuzzle__clinit_();
},
owtp_CubePuzzle__init_ = ($this, $size) => {
    owtp_CubePuzzle_$callClinit();
    a: {
        owts_Puzzle__init_($this);
        if (!owtp_CubePuzzle_$assertionsDisabled) {
            if ($size < 0)
                break a;
            if ($size >= owtp_CubePuzzle_DEFAULT_LENGTHS.data.length)
                break a;
        }
        $this.$size0 = $size;
        return;
    }
    $rt_throw(jl_AssertionError__init_2($rt_s(223)));
},
owtp_CubePuzzle__init_0 = var_0 => {
    let var_1 = new owtp_CubePuzzle();
    owtp_CubePuzzle__init_(var_1, var_0);
    return var_1;
},
owtp_CubePuzzle_swap = ($image, $f1, $x1, $y1, $f2, $x2, $y2, $f3, $x3, $y3, $f4, $x4, $y4, $dir) => {
    let var$15, $temp, var$17, var$18;
    owtp_CubePuzzle_$callClinit();
    a: {
        if ($dir == 1) {
            var$15 = $image.data;
            $temp = var$15[$f1].data[$x1].data[$y1];
            var$15[$f1].data[$x1].data[$y1] = var$15[$f2].data[$x2].data[$y2];
            var$15[$f2].data[$x2].data[$y2] = var$15[$f3].data[$x3].data[$y3];
            var$15[$f3].data[$x3].data[$y3] = var$15[$f4].data[$x4].data[$y4];
            var$15[$f4].data[$x4].data[$y4] = $temp;
        } else if ($dir == 2) {
            var$15 = $image.data;
            $temp = var$15[$f1].data[$x1].data[$y1];
            var$15[$f1].data[$x1].data[$y1] = var$15[$f3].data[$x3].data[$y3];
            var$15[$f3].data[$x3].data[$y3] = $temp;
            var$17 = var$15[$f2].data[$x2].data[$y2];
            var$15[$f2].data[$x2].data[$y2] = var$15[$f4].data[$x4].data[$y4];
            var$15[$f4].data[$x4].data[$y4] = var$17;
        } else {
            if ($dir != 3) {
                if (owtp_CubePuzzle_$assertionsDisabled)
                    break a;
                $rt_throw(jl_AssertionError__init_());
            }
            var$18 = $image.data;
            $temp = var$18[$f4].data[$x4].data[$y4];
            var$18[$f4].data[$x4].data[$y4] = var$18[$f3].data[$x3].data[$y3];
            var$18[$f3].data[$x3].data[$y3] = var$18[$f2].data[$x2].data[$y2];
            var$18[$f2].data[$x2].data[$y2] = var$18[$f1].data[$x1].data[$y1];
            var$18[$f1].data[$x1].data[$y1] = $temp;
        }
    }
},
owtp_CubePuzzle_slice = ($face, $slice, $dir, $image) => {
    let $size, var$6, var$7, var$8, $j, $f, $k, var$12, var$13, var$14, var$15, var$16, var$17, var$18;
    owtp_CubePuzzle_$callClinit();
    $size = $image.data[0].data.length;
    if (!owtp_CubePuzzle_$assertionsDisabled && !($slice >= 0 && $slice < $size))
        $rt_throw(jl_AssertionError__init_());
    owtp_CubePuzzle$Face_$callClinit();
    if ($face === owtp_CubePuzzle$Face_L) {
        var$6 = $face;
        var$7 = $slice;
        var$8 = $dir;
    } else if ($face === owtp_CubePuzzle$Face_D) {
        var$6 = $face;
        var$7 = $slice;
        var$8 = $dir;
    } else if ($face === owtp_CubePuzzle$Face_B) {
        var$6 = $face;
        var$7 = $slice;
        var$8 = $dir;
    } else {
        var$6 = owtp_CubePuzzle$Face_oppositeFace($face);
        var$7 = ($size - 1 | 0) - $slice | 0;
        var$8 = 4 - $dir | 0;
    }
    $j = 0;
    a: while (true) {
        if ($j >= $size) {
            b: {
                if (!($slice && $slice != ($size - 1 | 0))) {
                    if (!$slice) {
                        $f = jl_Enum_ordinal($face);
                        $dir = 4 - $dir | 0;
                    } else {
                        if ($slice != ($size - 1 | 0)) {
                            if (owtp_CubePuzzle_$assertionsDisabled)
                                return;
                            $rt_throw(jl_AssertionError__init_());
                        }
                        $f = jl_Enum_ordinal(owtp_CubePuzzle$Face_oppositeFace($face));
                    }
                    $j = 0;
                    while (true) {
                        if ($j >= (($size + 1 | 0) / 2 | 0))
                            break b;
                        $k = 0;
                        while ($k < ($size / 2 | 0)) {
                            var$12 = $size - 1 | 0;
                            var$13 = var$12 - $j | 0;
                            var$12 = var$12 - $k | 0;
                            owtp_CubePuzzle_swap($image, $f, $j, $k, $f, $k, var$13, $f, var$13, var$12, $f, var$12, $j, $dir);
                            $k = $k + 1 | 0;
                        }
                        $j = $j + 1 | 0;
                    }
                }
            }
            return;
        }
        c: {
            if (var$6 === owtp_CubePuzzle$Face_L) {
                var$14 = owtp_CubePuzzle$Face_U;
                var$12 = jl_Enum_ordinal(var$14);
                var$14 = owtp_CubePuzzle$Face_B;
                var$13 = jl_Enum_ordinal(var$14);
                var$15 = $size - 1 | 0;
                var$16 = var$15 - $j | 0;
                var$15 = var$15 - var$7 | 0;
                var$14 = owtp_CubePuzzle$Face_D;
                var$17 = jl_Enum_ordinal(var$14);
                var$14 = owtp_CubePuzzle$Face_F;
                var$18 = jl_Enum_ordinal(var$14);
                owtp_CubePuzzle_swap($image, var$12, $j, var$7, var$13, var$16, var$15, var$17, $j, var$7, var$18, $j, var$7, var$8);
            } else if (var$6 === owtp_CubePuzzle$Face_D) {
                var$14 = owtp_CubePuzzle$Face_L;
                var$12 = jl_Enum_ordinal(var$14);
                var$13 = ($size - 1 | 0) - var$7 | 0;
                var$14 = owtp_CubePuzzle$Face_B;
                var$15 = jl_Enum_ordinal(var$14);
                var$14 = owtp_CubePuzzle$Face_R;
                var$16 = jl_Enum_ordinal(var$14);
                var$14 = owtp_CubePuzzle$Face_F;
                var$17 = jl_Enum_ordinal(var$14);
                owtp_CubePuzzle_swap($image, var$12, var$13, $j, var$15, var$13, $j, var$16, var$13, $j, var$17, var$13, $j, var$8);
            } else {
                if (var$6 !== owtp_CubePuzzle$Face_B) {
                    if (owtp_CubePuzzle_$assertionsDisabled)
                        break c;
                    else
                        break a;
                }
                var$14 = owtp_CubePuzzle$Face_U;
                var$17 = jl_Enum_ordinal(var$14);
                var$14 = owtp_CubePuzzle$Face_R;
                var$18 = jl_Enum_ordinal(var$14);
                var$12 = $size - 1 | 0;
                var$15 = var$12 - var$7 | 0;
                var$14 = owtp_CubePuzzle$Face_D;
                var$16 = jl_Enum_ordinal(var$14);
                var$12 = var$12 - $j | 0;
                var$14 = owtp_CubePuzzle$Face_L;
                var$13 = jl_Enum_ordinal(var$14);
                owtp_CubePuzzle_swap($image, var$17, var$7, $j, var$18, $j, var$15, var$16, var$15, var$12, var$13, var$12, var$7, var$8);
            }
        }
        $j = $j + 1 | 0;
    }
    $rt_throw(jl_AssertionError__init_());
},
owtp_CubePuzzle_getSolvedState0 = $this => {
    return owtp_CubePuzzle$CubeState__init_2($this);
},
owtp_CubePuzzle_cloneImage = ($this, $image) => {
    let var$2, var$3, var$4, $imageCopy;
    var$2 = $image.data;
    var$3 = var$2.length;
    var$4 = var$2[0].data.length;
    $imageCopy = $rt_createIntMultiArray([var$2[0].data[0].data.length, var$4, var$3]);
    owts_Puzzle_deepCopy0($image, $imageCopy);
    return $imageCopy;
},
owtp_CubePuzzle_spinCube = ($this, $image, $face, $dir) => {
    let $slice;
    $slice = 0;
    while ($slice < $this.$size0) {
        owtp_CubePuzzle_slice($face, $slice, $dir, $image);
        $slice = $slice + 1 | 0;
    }
},
owtp_CubePuzzle_normalize = ($this, $image) => {
    let var$2, $spins, $stickersByPiece, $goal, var$6, var$7, $idx, $i, var$10, $t, $j, $f, $dir;
    var$2 = owtp_CubePuzzle_cloneImage($this, $image);
    $spins = 0;
    while (!owtp_CubePuzzle_isNormalized($this, var$2)) {
        if (!owtp_CubePuzzle_$assertionsDisabled && $spins >= 2)
            $rt_throw(jl_AssertionError__init_());
        $stickersByPiece = owtp_CubePuzzle_getStickersByPiece(var$2);
        $goal = 0;
        owtp_CubePuzzle$Face_$callClinit();
        var$6 = $goal | 1 << jl_Enum_ordinal(owtp_CubePuzzle$Face_B);
        var$7 = var$6 | 1 << jl_Enum_ordinal(owtp_CubePuzzle$Face_L);
        var$6 = var$7 | 1 << jl_Enum_ordinal(owtp_CubePuzzle$Face_D);
        $idx = (-1);
        $i = 0;
        a: {
            while (true) {
                var$10 = $stickersByPiece.data;
                if ($i >= var$10.length) {
                    $i = $idx;
                    break a;
                }
                $t = 0;
                $j = 0;
                while ($j < var$10[$i].data.length) {
                    $t = $t | 1 << var$10[$i].data[$j];
                    $j = $j + 1 | 0;
                }
                if ($t == var$6)
                    break;
                $i = $i + 1 | 0;
            }
        }
        if (!owtp_CubePuzzle_$assertionsDisabled && $i < 0)
            $rt_throw(jl_AssertionError__init_());
        b: {
            $f = null;
            $dir = 1;
            if (var$10[$i].data[0] == jl_Enum_ordinal(owtp_CubePuzzle$Face_D)) {
                if ($i < 4) {
                    $f = owtp_CubePuzzle$Face_F;
                    $dir = 2;
                } else {
                    $f = owtp_CubePuzzle$Face_U;
                    switch ($i) {
                        case 4:
                            break;
                        case 5:
                            $dir = 1;
                            break b;
                        case 6:
                            $dir = 3;
                            break b;
                        default:
                            if (!owtp_CubePuzzle_$assertionsDisabled)
                                $rt_throw(jl_AssertionError__init_());
                            break b;
                    }
                    $dir = 2;
                }
            } else if (var$10[$i].data[1] != jl_Enum_ordinal(owtp_CubePuzzle$Face_D)) {
                switch ($i) {
                    case 0:
                    case 5:
                        break;
                    case 1:
                    case 7:
                        $f = owtp_CubePuzzle$Face_B;
                        break b;
                    case 2:
                    case 4:
                        $f = owtp_CubePuzzle$Face_F;
                        break b;
                    case 3:
                    case 6:
                        $f = owtp_CubePuzzle$Face_R;
                        break b;
                    default:
                        if (!owtp_CubePuzzle_$assertionsDisabled)
                            $rt_throw(jl_AssertionError__init_());
                        break b;
                }
                $f = owtp_CubePuzzle$Face_L;
            } else {
                switch ($i) {
                    case 0:
                    case 6:
                        break;
                    case 1:
                    case 4:
                        $f = owtp_CubePuzzle$Face_L;
                        break b;
                    case 2:
                    case 7:
                        $f = owtp_CubePuzzle$Face_R;
                        break b;
                    case 3:
                    case 5:
                        $f = owtp_CubePuzzle$Face_B;
                        break b;
                    default:
                        if (!owtp_CubePuzzle_$assertionsDisabled)
                            $rt_throw(jl_AssertionError__init_());
                        break b;
                }
                $f = owtp_CubePuzzle$Face_F;
            }
        }
        owtp_CubePuzzle_spinCube($this, var$2, $f, $dir);
        $spins = $spins + 1 | 0;
    }
    return var$2;
},
owtp_CubePuzzle_isNormalized = ($this, $image) => {
    let var$2, var$3, var$4;
    a: {
        var$2 = $image.data;
        owtp_CubePuzzle$Face_$callClinit();
        if (var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_B)].data[$this.$size0 - 1 | 0].data[$this.$size0 - 1 | 0] == jl_Enum_ordinal(owtp_CubePuzzle$Face_B)) {
            var$3 = owtp_CubePuzzle$Face_L;
            if (var$2[jl_Enum_ordinal(var$3)].data[$this.$size0 - 1 | 0].data[0] == jl_Enum_ordinal(owtp_CubePuzzle$Face_L)) {
                var$3 = owtp_CubePuzzle$Face_D;
                if (var$2[jl_Enum_ordinal(var$3)].data[$this.$size0 - 1 | 0].data[0] == jl_Enum_ordinal(owtp_CubePuzzle$Face_D)) {
                    var$4 = 1;
                    break a;
                }
            }
        }
        var$4 = 0;
    }
    return var$4;
},
owtp_CubePuzzle_getStickersByPiece = $img => {
    let var$2, $s, var$4, var$5, var$6, var$7, var$8, var$9;
    owtp_CubePuzzle_$callClinit();
    var$2 = $img.data;
    $s = var$2[0].data.length - 1 | 0;
    var$4 = $rt_createArray($rt_arraycls($rt_intcls), 8);
    var$5 = var$4.data;
    var$6 = $rt_createIntArray(3);
    var$7 = var$6.data;
    owtp_CubePuzzle$Face_$callClinit();
    var$8 = owtp_CubePuzzle$Face_U;
    var$7[0] = var$2[jl_Enum_ordinal(var$8)].data[$s].data[$s];
    var$7[1] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_R)].data[0].data[0];
    var$7[2] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_F)].data[0].data[$s];
    var$5[0] = var$6;
    var$6 = $rt_createIntArray(3);
    var$7 = var$6.data;
    var$8 = owtp_CubePuzzle$Face_U;
    var$7[0] = var$2[jl_Enum_ordinal(var$8)].data[$s].data[0];
    var$7[1] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_F)].data[0].data[0];
    var$7[2] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_L)].data[0].data[$s];
    var$5[1] = var$6;
    var$6 = $rt_createIntArray(3);
    var$7 = var$6.data;
    var$8 = owtp_CubePuzzle$Face_U;
    var$7[0] = var$2[jl_Enum_ordinal(var$8)].data[0].data[$s];
    var$7[1] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_B)].data[0].data[0];
    var$7[2] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_R)].data[0].data[$s];
    var$5[2] = var$6;
    var$6 = $rt_createIntArray(3);
    var$7 = var$6.data;
    var$8 = owtp_CubePuzzle$Face_U;
    var$7[0] = var$2[jl_Enum_ordinal(var$8)].data[0].data[0];
    var$7[1] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_L)].data[0].data[0];
    var$7[2] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_B)].data[0].data[$s];
    var$5[3] = var$6;
    var$9 = $rt_createIntArray(3);
    var$6 = var$9.data;
    var$8 = owtp_CubePuzzle$Face_D;
    var$6[0] = var$2[jl_Enum_ordinal(var$8)].data[0].data[$s];
    var$6[1] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_F)].data[$s].data[$s];
    var$6[2] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_R)].data[$s].data[0];
    var$5[4] = var$9;
    var$7 = $rt_createIntArray(3);
    var$9 = var$7.data;
    var$8 = owtp_CubePuzzle$Face_D;
    var$9[0] = var$2[jl_Enum_ordinal(var$8)].data[0].data[0];
    var$9[1] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_L)].data[$s].data[$s];
    var$9[2] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_F)].data[$s].data[0];
    var$5[5] = var$7;
    var$6 = $rt_createIntArray(3);
    var$7 = var$6.data;
    var$8 = owtp_CubePuzzle$Face_D;
    var$7[0] = var$2[jl_Enum_ordinal(var$8)].data[$s].data[$s];
    var$7[1] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_R)].data[$s].data[$s];
    var$7[2] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_B)].data[$s].data[0];
    var$5[6] = var$6;
    var$7 = $rt_createIntArray(3);
    var$9 = var$7.data;
    var$8 = owtp_CubePuzzle$Face_D;
    var$9[0] = var$2[jl_Enum_ordinal(var$8)].data[$s].data[0];
    var$9[1] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_B)].data[$s].data[$s];
    var$9[2] = var$2[jl_Enum_ordinal(owtp_CubePuzzle$Face_L)].data[$s].data[0];
    var$5[7] = var$7;
    return var$4;
},
owtp_CubePuzzle_getSolvedState = $this => {
    return $this.$getSolvedState0();
},
owtp_CubePuzzle_access$000 = () => {
    owtp_CubePuzzle_$callClinit();
    return owtp_CubePuzzle_faceRotationsByName;
},
owtp_CubePuzzle_access$100 = () => {
    owtp_CubePuzzle_$callClinit();
    return owtp_CubePuzzle_DIR_TO_STR;
},
owtp_CubePuzzle_access$200 = ($x0, $x1) => {
    owtp_CubePuzzle_$callClinit();
    return owtp_CubePuzzle_isNormalized($x0, $x1);
},
owtp_CubePuzzle_access$300 = ($x0, $x1) => {
    owtp_CubePuzzle_$callClinit();
    return owtp_CubePuzzle_normalize($x0, $x1);
},
owtp_CubePuzzle_access$400 = ($x0, $x1) => {
    owtp_CubePuzzle_$callClinit();
    return owtp_CubePuzzle_cloneImage($x0, $x1);
},
owtp_CubePuzzle_access$500 = ($x0, $x1, $x2, $x3) => {
    owtp_CubePuzzle_$callClinit();
    owtp_CubePuzzle_slice($x0, $x1, $x2, $x3);
},
owtp_CubePuzzle__clinit_ = () => {
    let var$1, var$2, var$3;
    owtp_CubePuzzle_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_CubePuzzle)) ? 0 : 1;
    var$1 = $rt_createArray(jl_String, 4);
    var$2 = var$1.data;
    var$2[0] = null;
    var$2[1] = $rt_s(3);
    var$2[2] = $rt_s(224);
    var$2[3] = $rt_s(4);
    owtp_CubePuzzle_DIR_TO_STR = var$1;
    owtp_CubePuzzle_faceRotationsByName = ju_HashMap__init_();
    var$3 = owtp_CubePuzzle_faceRotationsByName;
    owtp_CubePuzzle$Face_$callClinit();
    var$3.$put(owtp_CubePuzzle$Face_R, $rt_s(225));
    owtp_CubePuzzle_faceRotationsByName.$put(owtp_CubePuzzle$Face_U, $rt_s(226));
    owtp_CubePuzzle_faceRotationsByName.$put(owtp_CubePuzzle$Face_F, $rt_s(227));
    owtp_CubePuzzle_DEFAULT_LENGTHS = $rt_createIntArrayFromData([0, 0, 25, 25, 40, 60, 80, 100, 120, 140, 160, 180]);
    owtp_CubePuzzle_defaultColorScheme = ju_HashMap__init_();
    var$3 = owtp_CubePuzzle_defaultColorScheme;
    owts_Color_$callClinit();
    var$3.$put($rt_s(228), owts_Color_BLUE);
    owtp_CubePuzzle_defaultColorScheme.$put($rt_s(62), owts_Color_YELLOW);
    owtp_CubePuzzle_defaultColorScheme.$put($rt_s(23), owts_Color_GREEN);
    owtp_CubePuzzle_defaultColorScheme.$put($rt_s(222), owts_Color__init_(255, 128, 0));
    owtp_CubePuzzle_defaultColorScheme.$put($rt_s(20), owts_Color_RED);
    owtp_CubePuzzle_defaultColorScheme.$put($rt_s(17), owts_Color_WHITE);
},
ju_TemplateCollections$AbstractImmutableMap = $rt_classWithoutFields(ju_AbstractMap),
ju_TemplateCollections$AbstractImmutableMap__init_ = $this => {
    ju_AbstractMap__init_($this);
},
ju_TemplateCollections$AbstractImmutableMap_put = ($this, $key, $value) => {
    $rt_throw(jl_UnsupportedOperationException__init_0());
};
function jur_Quantifier() {
    let a = this; jur_SpecialToken.call(a);
    a.$min2 = 0;
    a.$max1 = 0;
}
let jur_Quantifier__init_ = ($this, $min, $max) => {
    jur_SpecialToken__init_($this);
    $this.$min2 = $min;
    $this.$max1 = $max;
},
jur_Quantifier__init_0 = (var_0, var_1) => {
    let var_2 = new jur_Quantifier();
    jur_Quantifier__init_(var_2, var_0, var_1);
    return var_2;
},
jur_Quantifier_min = $this => {
    return $this.$min2;
},
jur_Quantifier_max = $this => {
    return $this.$max1;
},
jur_Quantifier_toString = $this => {
    let var$1, var$2, var$3;
    var$1 = $this.$min2;
    var$2 = $this.$max1 == 2147483647 ? $rt_s(3) : jl_Integer_toString($this.$max1);
    var$3 = jl_StringBuilder__init_();
    jl_StringBuilder_append0(jl_StringBuilder_append(jl_StringBuilder_append0(jl_StringBuilder_append1(jl_StringBuilder_append0(var$3, 123), var$1), 44), var$2), 125);
    return jl_StringBuilder_toString(var$3);
};
function jur_AbstractCharClass$LazyJavaUpperCase$1() {
    jur_AbstractCharClass.call(this);
    this.$this$015 = null;
}
let jur_AbstractCharClass$LazyJavaUpperCase$1__init_ = ($this, $this$0) => {
    $this.$this$015 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaUpperCase$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaUpperCase$1();
    jur_AbstractCharClass$LazyJavaUpperCase$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaUpperCase$1_contains = ($this, $ch) => {
    return jl_Character_isUpperCase($ch);
},
jlr_Array = $rt_classWithoutFields(),
jlr_Array_getLength = $array => {
    let $cls;
    $cls = jl_Class_getClassInfo(jl_Object_getClass($array));
    if ($cls[$rt_meta].itemType !== null)
        return $rt_arrayLength($array);
    $rt_throw(jl_IllegalArgumentException__init_());
},
jlr_Array_newInstance = ($componentType, $length) => {
    let $cls;
    if ($componentType === null)
        $rt_throw(jl_NullPointerException__init_2());
    if ($componentType === $rt_cls($rt_voidcls))
        $rt_throw(jl_IllegalArgumentException__init_());
    if ($length < 0)
        $rt_throw(jl_NegativeArraySizeException__init_0());
    $cls = jl_Class_getClassInfo($componentType);
    return otrr_ClassInfo_newArrayInstance($cls, $length);
},
jl_Iterable = $rt_classWithoutFields(0),
ju_Collection = $rt_classWithoutFields(0),
ju_Set = $rt_classWithoutFields(0),
ju_SequencedCollection = $rt_classWithoutFields(0),
ju_SequencedSet = $rt_classWithoutFields(0),
ju_SortedSet = $rt_classWithoutFields(0),
ju_ListIterator = $rt_classWithoutFields(0),
otpp_ResourceAccessor = $rt_classWithoutFields(),
jur_AbstractCharClass$LazyJavaDigit = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaDigit__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaDigit__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaDigit();
    jur_AbstractCharClass$LazyJavaDigit__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaDigit_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaDigit$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
},
ju_AbstractCollection = $rt_classWithoutFields(),
ju_AbstractCollection__init_ = $this => {
    jl_Object__init_($this);
},
ju_AbstractCollection_isEmpty = $this => {
    return $this.$size() ? 0 : 1;
},
ju_AbstractCollection_toArray = ($this, $a) => {
    let var$2, $i, var$4, $iter;
    var$2 = $a.data;
    $i = $this.$size();
    var$4 = var$2.length;
    if (var$4 < $i)
        $a = jlr_Array_newInstance(jl_Class_getComponentType(jl_Object_getClass($a)), $i);
    else
        while ($i < var$4) {
            var$2[$i] = null;
            $i = $i + 1 | 0;
        }
    $i = 0;
    $iter = $this.$iterator();
    while ($iter.$hasNext()) {
        var$2 = $a.data;
        var$4 = $i + 1 | 0;
        var$2[$i] = $iter.$next();
        $i = var$4;
    }
    return $a;
},
jur_PossessiveQuantifierSet = $rt_classWithoutFields(jur_LeafQuantifierSet),
jur_PossessiveQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_LeafQuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_PossessiveQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_PossessiveQuantifierSet();
    jur_PossessiveQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_PossessiveQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let var$4;
    a: {
        while (true) {
            if (($stringIndex + $this.$leaf.$charCount() | 0) > $matchResult.$getRightBound())
                break a;
            var$4 = $this.$leaf.$accepts($stringIndex, $testString);
            if (var$4 < 1)
                break;
            $stringIndex = $stringIndex + var$4 | 0;
        }
    }
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
otci_IntegerUtil = $rt_classWithoutFields(),
otci_IntegerUtil_toUnsignedLogRadixString = ($value, $radixLog2) => {
    let $radix, $mask, $sz, $chars, $pos, $target, var$9, $target_0;
    if (!$value)
        return $rt_s(229);
    $radix = 1 << $radixLog2;
    $mask = $radix - 1 | 0;
    $sz = (((32 - jl_Integer_numberOfLeadingZeros($value) | 0) + $radixLog2 | 0) - 1 | 0) / $radixLog2 | 0;
    $chars = $rt_createCharArray($sz);
    $pos = $rt_imul($sz - 1 | 0, $radixLog2);
    $target = 0;
    while ($pos >= 0) {
        var$9 = $chars.data;
        $target_0 = $target + 1 | 0;
        var$9[$target] = jl_Character_forDigit(($value >>> $pos | 0) & $mask, $radix);
        $pos = $pos - $radixLog2 | 0;
        $target = $target_0;
    }
    return jl_String__init_0($chars);
},
jl_Short = $rt_classWithoutFields(jl_Number),
jl_Short_TYPE = null,
jl_Short_$callClinit = () => {
    jl_Short_$callClinit = $rt_eraseClinit(jl_Short);
    jl_Short__clinit_();
},
jl_Short_hashCode = $value => {
    jl_Short_$callClinit();
    return $value;
},
jl_Short__clinit_ = () => {
    jl_Short_TYPE = $rt_cls($rt_shortcls);
},
jur_AltQuantifierSet = $rt_classWithoutFields(jur_LeafQuantifierSet),
jur_AltQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_LeafQuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_AltQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_AltQuantifierSet();
    jur_AltQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_AltQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $shift;
    $shift = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    if ($shift < 0)
        $shift = $this.$next3.$matches($stringIndex, $testString, $matchResult);
    return $shift;
},
jur_AltQuantifierSet_setNext = ($this, $next) => {
    jur_AbstractSet_setNext($this, $next);
    $this.$innerSet.$setNext($next);
},
jur_PossessiveAltQuantifierSet = $rt_classWithoutFields(jur_AltQuantifierSet),
jur_PossessiveAltQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_AltQuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_PossessiveAltQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_PossessiveAltQuantifierSet();
    jur_PossessiveAltQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_PossessiveAltQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let var$4;
    if (($stringIndex + $this.$leaf.$charCount() | 0) <= $matchResult.$getRightBound()) {
        var$4 = $this.$leaf.$accepts($stringIndex, $testString);
        if (var$4 >= 1)
            $stringIndex = $stringIndex + var$4 | 0;
    }
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
};
function jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1() {
    jur_AbstractCharClass.call(this);
    this.$this$035 = null;
}
let jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1__init_ = ($this, $this$0) => {
    $this.$this$035 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1();
    jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1_contains = ($this, $ch) => {
    return jl_Character_isIdentifierIgnorable($ch);
},
jl_Thread$UncaughtExceptionHandler = $rt_classWithoutFields(0),
jl_DefaultUncaughtExceptionHandler = $rt_classWithoutFields(),
jl_DefaultUncaughtExceptionHandler__init_ = $this => {
    jl_Object__init_($this);
},
jl_DefaultUncaughtExceptionHandler__init_0 = () => {
    let var_0 = new jl_DefaultUncaughtExceptionHandler();
    jl_DefaultUncaughtExceptionHandler__init_(var_0);
    return var_0;
},
cm_Util = $rt_classWithoutFields(),
cm_Util_cornerFacelet = null,
cm_Util_edgeFacelet = null,
cm_Util_Cnk = null,
cm_Util_move2str = null,
cm_Util_ud2std = null,
cm_Util_std2ud = null,
cm_Util_ckmv2bit = null,
cm_Util_$callClinit = () => {
    cm_Util_$callClinit = $rt_eraseClinit(cm_Util);
    cm_Util__clinit_();
},
cm_Util_toCubieCube = ($f, $ccRet) => {
    let $i, $ori, var$5, $col1, $col2, $j;
    cm_Util_$callClinit();
    $i = 0;
    while ($i < 8) {
        $ccRet.$ca.data[$i] = 0;
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 12) {
        $ccRet.$ea.data[$i] = 0;
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 8) {
        $ori = 0;
        a: {
            while (true) {
                if ($ori >= 3)
                    break a;
                var$5 = $f.data;
                if (!var$5[cm_Util_cornerFacelet.data[$i].data[$ori]])
                    break a;
                if (var$5[cm_Util_cornerFacelet.data[$i].data[$ori]] == 3)
                    break;
                $ori = ($ori + 1 | 0) << 24 >> 24;
            }
        }
        var$5 = $f.data;
        $col1 = var$5[cm_Util_cornerFacelet.data[$i].data[($ori + 1 | 0) % 3 | 0]];
        $col2 = var$5[cm_Util_cornerFacelet.data[$i].data[($ori + 2 | 0) % 3 | 0]];
        $j = 0;
        b: {
            while (true) {
                if ($j >= 8)
                    break b;
                if ($col1 == (cm_Util_cornerFacelet.data[$j].data[1] / 9 | 0) && $col2 == (cm_Util_cornerFacelet.data[$j].data[2] / 9 | 0))
                    break;
                $j = ($j + 1 | 0) << 24 >> 24;
            }
            $ccRet.$ca.data[$i] = (($ori % 3 | 0) << 3 | $j) << 24 >> 24;
        }
        $i = ($i + 1 | 0) << 24 >> 24;
    }
    $i = 0;
    while ($i < 12) {
        $j = 0;
        c: {
            while (true) {
                if ($j >= 12)
                    break c;
                var$5 = $f.data;
                if (var$5[cm_Util_edgeFacelet.data[$i].data[0]] == (cm_Util_edgeFacelet.data[$j].data[0] / 9 | 0) && var$5[cm_Util_edgeFacelet.data[$i].data[1]] == (cm_Util_edgeFacelet.data[$j].data[1] / 9 | 0))
                    break;
                if (var$5[cm_Util_edgeFacelet.data[$i].data[0]] == (cm_Util_edgeFacelet.data[$j].data[1] / 9 | 0) && var$5[cm_Util_edgeFacelet.data[$i].data[1]] == (cm_Util_edgeFacelet.data[$j].data[0] / 9 | 0)) {
                    $ccRet.$ea.data[$i] = ($j << 1 | 1) << 24 >> 24;
                    break c;
                }
                $j = ($j + 1 | 0) << 24 >> 24;
            }
            $ccRet.$ea.data[$i] = $j << 1 << 24 >> 24;
        }
        $i = ($i + 1 | 0) << 24 >> 24;
    }
},
cm_Util_toFaceCube = $cc => {
    let $f, $ts, var$4, $i, $c, $j, $ori, $n, $e;
    cm_Util_$callClinit();
    $f = $rt_createCharArray(54);
    $ts = $rt_createCharArray(6);
    var$4 = $ts.data;
    var$4[0] = 85;
    var$4[1] = 82;
    var$4[2] = 70;
    var$4[3] = 68;
    var$4[4] = 76;
    var$4[5] = 66;
    $i = 0;
    while ($i < 54) {
        $f.data[$i] = var$4[$i / 9 | 0];
        $i = $i + 1 | 0;
    }
    $c = 0;
    while ($c < 8) {
        $j = $cc.$ca.data[$c] & 7;
        $ori = $cc.$ca.data[$c] >> 3;
        $n = 0;
        while ($n < 3) {
            $f.data[cm_Util_cornerFacelet.data[$c].data[($n + $ori | 0) % 3 | 0]] = var$4[cm_Util_cornerFacelet.data[$j].data[$n] / 9 | 0];
            $n = ($n + 1 | 0) << 24 >> 24;
        }
        $c = ($c + 1 | 0) << 24 >> 24;
    }
    $e = 0;
    while ($e < 12) {
        $j = $cc.$ea.data[$e] >> 1;
        $ori = $cc.$ea.data[$e] & 1;
        $n = 0;
        while ($n < 2) {
            $f.data[cm_Util_edgeFacelet.data[$e].data[($n + $ori | 0) % 2 | 0]] = var$4[cm_Util_edgeFacelet.data[$j].data[$n] / 9 | 0];
            $n = ($n + 1 | 0) << 24 >> 24;
        }
        $e = ($e + 1 | 0) << 24 >> 24;
    }
    return jl_String__init_0($f);
},
cm_Util_getNParity = ($idx, $n) => {
    let $p, $i, var$5;
    cm_Util_$callClinit();
    $p = 0;
    $i = $n - 2 | 0;
    while ($i >= 0) {
        var$5 = $n - $i | 0;
        $p = $p ^ ($idx % var$5 | 0);
        $idx = $idx / var$5 | 0;
        $i = $i + (-1) | 0;
    }
    return $p & 1;
},
cm_Util_setVal = ($val0, $val, $isEdge) => {
    cm_Util_$callClinit();
    return (!$isEdge ? $val | $val0 & 248 : $val << 1 | $val0 & 1) << 24 >> 24;
},
cm_Util_getVal = ($val0, $isEdge) => {
    cm_Util_$callClinit();
    return !$isEdge ? $val0 & 7 : $val0 >> 1;
},
cm_Util_setNPerm = ($arr, $idx, $n, $isEdge) => {
    let $val, $extract, $p, $i, var$9, var$10, $v, $m;
    cm_Util_$callClinit();
    $val = Long_create(1985229328, 4275878552);
    $extract = Long_ZERO;
    $p = 2;
    while ($p <= $n) {
        $extract = Long_or(Long_shl($extract, 4), Long_fromInt($idx % $p | 0));
        $idx = $idx / $p | 0;
        $p = $p + 1 | 0;
    }
    $i = 0;
    while (true) {
        var$9 = $n - 1 | 0;
        if ($i >= var$9)
            break;
        var$10 = $arr.data;
        $v = (Long_lo($extract) & 15) << 2;
        $extract = Long_shr($extract, 4);
        var$10[$i] = cm_Util_setVal(var$10[$i], Long_lo(Long_and(Long_shr($val, $v), Long_fromInt(15))), $isEdge);
        $m = Long_sub(Long_shl(Long_fromInt(1), $v), Long_fromInt(1));
        $val = Long_or(Long_and($val, $m), Long_and(Long_shr($val, 4), Long_xor($m, Long_fromInt(-1))));
        $i = $i + 1 | 0;
    }
    var$10 = $arr.data;
    var$10[var$9] = cm_Util_setVal(var$10[var$9], Long_lo(Long_and($val, Long_fromInt(15))), $isEdge);
},
cm_Util_getNPerm = ($arr, $n, $isEdge) => {
    let $idx, $val, $i, $v;
    cm_Util_$callClinit();
    $idx = 0;
    $val = Long_create(1985229328, 4275878552);
    $i = 0;
    while ($i < ($n - 1 | 0)) {
        $v = cm_Util_getVal($arr.data[$i], $isEdge) << 2;
        $idx = $rt_imul($n - $i | 0, $idx) + Long_lo(Long_and(Long_shr($val, $v), Long_fromInt(15))) | 0;
        $val = Long_sub($val, Long_shl(Long_create(286331152, 286331153), $v));
        $i = $i + 1 | 0;
    }
    return $idx;
},
cm_Util_getComb = ($arr, $mask, $isEdge) => {
    let var$4, $i, $idxC, $r, $perm, var$9, var$10;
    cm_Util_$callClinit();
    var$4 = $arr.data;
    $i = var$4.length - 1 | 0;
    $idxC = 0;
    $r = 4;
    while ($i >= 0) {
        $perm = cm_Util_getVal(var$4[$i], $isEdge);
        if (($perm & 12) == $mask) {
            var$9 = cm_Util_Cnk.data[$i].data;
            var$10 = $r + (-1) | 0;
            $idxC = $idxC + var$9[$r] | 0;
            $r = var$10;
        }
        $i = $i + (-1) | 0;
    }
    return $idxC;
},
cm_Util_setComb = ($arr, $idxC, $mask, $isEdge) => {
    let var$5, $end, $r, $i, var$9, var$10, var$11, var$12;
    cm_Util_$callClinit();
    var$5 = $arr.data;
    $end = var$5.length - 1 | 0;
    $r = 4;
    $i = $end;
    while ($i >= 0) {
        if ($idxC >= cm_Util_Cnk.data[$i].data[$r]) {
            var$9 = cm_Util_Cnk.data[$i].data;
            var$10 = $r + (-1) | 0;
            $idxC = $idxC - var$9[$r] | 0;
            var$5[$i] = cm_Util_setVal(var$5[$i], var$10 | $mask, $isEdge);
        } else {
            var$11 = ($end & 12) != $mask ? $end : $end + (-4) | 0;
            var$12 = var$5[$i];
            $end = var$11 + (-1) | 0;
            var$5[$i] = cm_Util_setVal(var$12, var$11, $isEdge);
            var$10 = $r;
        }
        $i = $i + (-1) | 0;
        $r = var$10;
    }
},
cm_Util__clinit_ = () => {
    let var$1, var$2, $i, $ix, $j, $jx, var$7, var$8, var$9;
    var$1 = $rt_createArray($rt_arraycls($rt_bytecls), 8);
    var$2 = var$1.data;
    var$2[0] = $rt_createByteArrayFromData([8, 9, 20]);
    var$2[1] = $rt_createByteArrayFromData([6, 18, 38]);
    var$2[2] = $rt_createByteArrayFromData([0, 36, 47]);
    var$2[3] = $rt_createByteArrayFromData([2, 45, 11]);
    var$2[4] = $rt_createByteArrayFromData([29, 26, 15]);
    var$2[5] = $rt_createByteArrayFromData([27, 44, 24]);
    var$2[6] = $rt_createByteArrayFromData([33, 53, 42]);
    var$2[7] = $rt_createByteArrayFromData([35, 17, 51]);
    cm_Util_cornerFacelet = var$1;
    var$1 = $rt_createArray($rt_arraycls($rt_bytecls), 12);
    var$2 = var$1.data;
    var$2[0] = $rt_createByteArrayFromData([5, 10]);
    var$2[1] = $rt_createByteArrayFromData([7, 19]);
    var$2[2] = $rt_createByteArrayFromData([3, 37]);
    var$2[3] = $rt_createByteArrayFromData([1, 46]);
    var$2[4] = $rt_createByteArrayFromData([32, 16]);
    var$2[5] = $rt_createByteArrayFromData([28, 25]);
    var$2[6] = $rt_createByteArrayFromData([30, 43]);
    var$2[7] = $rt_createByteArrayFromData([34, 52]);
    var$2[8] = $rt_createByteArrayFromData([23, 12]);
    var$2[9] = $rt_createByteArrayFromData([21, 41]);
    var$2[10] = $rt_createByteArrayFromData([50, 39]);
    var$2[11] = $rt_createByteArrayFromData([48, 14]);
    cm_Util_edgeFacelet = var$1;
    cm_Util_Cnk = $rt_createIntMultiArray([13, 13]);
    cm_Util_move2str = $rt_wrapArray(jl_String, [$rt_s(230), $rt_s(18), $rt_s(19), $rt_s(231), $rt_s(21), $rt_s(22), $rt_s(232), $rt_s(24), $rt_s(25), $rt_s(233), $rt_s(234), $rt_s(235), $rt_s(236), $rt_s(237), $rt_s(238), $rt_s(239), $rt_s(240), $rt_s(241)]);
    cm_Util_ud2std = $rt_createIntArrayFromData([0, 1, 2, 4, 7, 9, 10, 11, 13, 16, 3, 5, 6, 8, 12, 14, 15, 17]);
    cm_Util_std2ud = $rt_createIntArray(18);
    cm_Util_ckmv2bit = $rt_createIntArray(11);
    $i = 0;
    while ($i < 18) {
        cm_Util_std2ud.data[cm_Util_ud2std.data[$i]] = $i;
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 10) {
        $ix = cm_Util_ud2std.data[$i] / 3 | 0;
        cm_Util_ckmv2bit.data[$i] = 0;
        $j = 0;
        while ($j < 10) {
            a: {
                b: {
                    $jx = cm_Util_ud2std.data[$j] / 3 | 0;
                    var$1 = cm_Util_ckmv2bit.data;
                    var$7 = var$1[$i];
                    var$8 = $rt_compare($ix, $jx);
                    if (var$8) {
                        if (($ix % 3 | 0) != ($jx % 3 | 0))
                            break b;
                        if (var$8 < 0)
                            break b;
                    }
                    var$8 = 1;
                    break a;
                }
                var$8 = 0;
            }
            var$1[$i] = var$7 | var$8 << $j;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
    cm_Util_ckmv2bit.data[10] = 0;
    $i = 0;
    while ($i < 13) {
        var$9 = cm_Util_Cnk.data[$i].data;
        cm_Util_Cnk.data[$i].data[$i] = 1;
        var$9[0] = 1;
        $j = 1;
        while ($j < $i) {
            var$9 = cm_Util_Cnk.data[$i].data;
            var$1 = cm_Util_Cnk.data;
            var$7 = $i - 1 | 0;
            var$9[$j] = var$1[var$7].data[$j - 1 | 0] + cm_Util_Cnk.data[var$7].data[$j] | 0;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
};
function jur_AbstractCharClass$LazyJavaLetter$1() {
    jur_AbstractCharClass.call(this);
    this.$this$029 = null;
}
let jur_AbstractCharClass$LazyJavaLetter$1__init_ = ($this, $this$0) => {
    $this.$this$029 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaLetter$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaLetter$1();
    jur_AbstractCharClass$LazyJavaLetter$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaLetter$1_contains = ($this, $ch) => {
    return jl_Character_isLetter($ch);
},
jur_ReluctantQuantifierSet = $rt_classWithoutFields(jur_LeafQuantifierSet),
jur_ReluctantQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_LeafQuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_ReluctantQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_ReluctantQuantifierSet();
    jur_ReluctantQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_ReluctantQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let var$4;
    while (true) {
        var$4 = $this.$next3.$matches($stringIndex, $testString, $matchResult);
        if (var$4 >= 0)
            break;
        if (($stringIndex + $this.$leaf.$charCount() | 0) <= $matchResult.$getRightBound()) {
            var$4 = $this.$leaf.$accepts($stringIndex, $testString);
            $stringIndex = $stringIndex + var$4 | 0;
        }
        if (var$4 < 1)
            return (-1);
    }
    return var$4;
};
function jl_ThreadLocal() {
    let a = this; jl_Object.call(a);
    a.$map = null;
    a.$initialized = 0;
    a.$value4 = null;
}
let jl_ThreadLocal_NULL = null,
jl_ThreadLocal_$callClinit = () => {
    jl_ThreadLocal_$callClinit = $rt_eraseClinit(jl_ThreadLocal);
    jl_ThreadLocal__clinit_();
},
jl_ThreadLocal__init_ = $this => {
    jl_ThreadLocal_$callClinit();
    jl_Object__init_($this);
},
jl_ThreadLocal__init_0 = () => {
    let var_0 = new jl_ThreadLocal();
    jl_ThreadLocal__init_(var_0);
    return var_0;
},
jl_ThreadLocal_get = $this => {
    let $key, $value;
    if (jl_ThreadLocal_isInMainThread()) {
        if (!$this.$initialized) {
            $this.$value4 = $this.$initialValue();
            $this.$initialized = 1;
        }
        jl_ThreadLocal_cleanupMap($this);
        return $this.$value4;
    }
    $key = (jl_Thread_currentThread()).$key1;
    jl_ThreadLocal_initMap($this);
    $value = $this.$map.$get($key);
    if ($value === null) {
        $value = $this.$initialValue();
        $this.$map.$put($key, $value !== null ? $value : jl_ThreadLocal_NULL);
    } else if ($value === jl_ThreadLocal_NULL)
        $value = null;
    jl_ThreadLocal_cleanupMap($this);
    return $value;
},
jl_ThreadLocal_initMap = $this => {
    if ($this.$map === null)
        $this.$map = ju_WeakHashMap__init_1();
},
jl_ThreadLocal_cleanupMap = $this => {
    if ($this.$map !== null && $this.$map.$isEmpty())
        $this.$map = null;
},
jl_ThreadLocal_withInitial = $supplier => {
    jl_ThreadLocal_$callClinit();
    return jl_ThreadLocal$1__init_0($supplier);
},
jl_ThreadLocal_isInMainThread = () => {
    jl_ThreadLocal_$callClinit();
    return jl_Thread_currentThread() !== jl_Thread_getMainThread() ? 0 : 1;
},
jl_ThreadLocal__clinit_ = () => {
    jl_ThreadLocal_NULL = jl_Object__init_0();
},
otji_JS = $rt_classWithoutFields();
function jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1() {
    jur_AbstractCharClass.call(this);
    this.$this$039 = null;
}
let jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1__init_ = ($this, $this$0) => {
    $this.$this$039 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1();
    jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1_contains = ($this, $ch) => {
    return jl_Character_isUnicodeIdentifierStart($ch);
},
otp_PlatformRunnable = $rt_classWithoutFields(0),
otciu_UnicodeHelper = $rt_classWithoutFields(),
otciu_UnicodeHelper_decodeIntPairsDiff = $text => {
    let $flow, $sz, $data, $j, $lastKey, $lastValue, $i, var$9, var$10;
    $flow = otci_CharFlow__init_0($text.$toCharArray());
    $sz = otci_Base46_decodeUnsigned($flow);
    $data = $rt_createIntArray($sz * 2 | 0);
    $j = 0;
    $lastKey = 0;
    $lastValue = 0;
    $i = 0;
    while ($i < $sz) {
        var$9 = $data.data;
        $lastKey = $lastKey + otci_Base46_decode($flow) | 0;
        $lastValue = $lastValue + otci_Base46_decode($flow) | 0;
        var$10 = $j + 1 | 0;
        var$9[$j] = $lastKey;
        $j = var$10 + 1 | 0;
        var$9[var$10] = $lastValue;
        $i = $i + 1 | 0;
    }
    return $data;
},
otciu_UnicodeHelper_decodeCaseMapping = $text => {
    let $flow, $sz, $data, $last, $i, var$7, var$8;
    $flow = otci_CharFlow__init_0($text.$toCharArray());
    $sz = otci_Base46_decodeUnsigned($flow);
    $data = $rt_createIntArray($sz * 2 | 0);
    $last = 0;
    $i = 0;
    while ($i < $sz) {
        var$7 = $data.data;
        $last = $last + otci_Base46_decodeUnsigned($flow) | 0;
        var$8 = $i * 2 | 0;
        var$7[var$8] = $last;
        var$7[var$8 + 1 | 0] = otci_Base46_decode($flow);
        $i = $i + 1 | 0;
    }
    return $data;
},
otciu_UnicodeHelper_createCharMapping = $data => {
    let $result, $last, $lastValue, $i, var$6, var$7, $key, $value, var$10;
    $result = $rt_createIntArray(65536);
    $last = 0;
    $lastValue = 0;
    $i = 0;
    a: {
        while (true) {
            var$6 = $data.data;
            if ($i >= var$6.length)
                break a;
            var$7 = $result.data;
            $key = var$6[$i];
            $value = var$6[$i + 1 | 0];
            var$10 = var$7.length;
            if ($key < var$10)
                var$10 = $key;
            else if ($key == $last)
                break;
            ju_Arrays_fill0($result, $last, var$10, $lastValue);
            $i = $i + 2 | 0;
            $last = var$10;
            $lastValue = $value;
        }
    }
    return otciu_CharMapping__init_0($data, $result);
},
otciu_UnicodeHelper_decodeByte = $c => {
    if ($c > 92)
        return (($c - 32 | 0) - 2 | 0) << 24 >> 24;
    if ($c <= 34)
        return ($c - 32 | 0) << 24 >> 24;
    return (($c - 32 | 0) - 1 | 0) << 24 >> 24;
},
otciu_UnicodeHelper_extractRle = $encoded => {
    let $ranges, $buffer, $index, $rangeIndex, $codePoint, $i, $b, $count, $pos, $j, $digit, var$13, var$14, var$15, var$16, var$17, var$18, $chunk;
    $ranges = $rt_createArray(otciu_UnicodeHelper$Range, 16384);
    $buffer = $rt_createByteArray(16384);
    $index = 0;
    $rangeIndex = 0;
    $codePoint = 0;
    $i = 0;
    while ($i < $encoded.$length()) {
        $b = otciu_UnicodeHelper_decodeByte($encoded.$charAt($i));
        if ($b == 64) {
            $i = $i + 1 | 0;
            $b = otciu_UnicodeHelper_decodeByte($encoded.$charAt($i));
            $count = 0;
            $pos = 1;
            $j = 0;
            while ($j < 3) {
                $i = $i + 1 | 0;
                $digit = otciu_UnicodeHelper_decodeByte($encoded.$charAt($i));
                $count = $count | $rt_imul($pos, $digit);
                $pos = $pos * 64 | 0;
                $j = $j + 1 | 0;
            }
        } else if ($b < 32)
            $count = 1;
        else {
            $b = ($b - 32 | 0) << 24 >> 24;
            $i = $i + 1 | 0;
            $count = otciu_UnicodeHelper_decodeByte($encoded.$charAt($i));
        }
        if (!$b && $count >= 128) {
            if ($index > 0) {
                var$13 = $ranges.data;
                var$14 = $rangeIndex + 1 | 0;
                var$13[$rangeIndex] = otciu_UnicodeHelper$Range__init_0($codePoint, $codePoint + $index | 0, ju_Arrays_copyOf($buffer, $index));
                $rangeIndex = var$14;
            }
            $codePoint = $codePoint + ($index + $count | 0) | 0;
            $index = 0;
        } else
            while ($count > 0) {
                var$14 = $buffer.data.length;
                if ($index != var$14)
                    var$15 = $index;
                else {
                    var$13 = $ranges.data;
                    var$16 = $rangeIndex + 1 | 0;
                    var$17 = new otciu_UnicodeHelper$Range;
                    var$18 = $codePoint + $index | 0;
                    otciu_UnicodeHelper$Range__init_(var$17, $codePoint, var$18, ju_Arrays_copyOf($buffer, $index));
                    var$13[$rangeIndex] = var$17;
                    var$15 = 0;
                    $rangeIndex = var$16;
                    $codePoint = var$18;
                }
                $chunk = jl_Math_min($count, var$14 - var$15 | 0);
                $index = var$15 + $chunk | 0;
                ju_Arrays_fill1($buffer, var$15, $index, $b);
                $count = $count - $chunk | 0;
            }
        $i = $i + 1 | 0;
    }
    if ($index <= 0)
        var$14 = $rangeIndex;
    else {
        var$13 = $ranges.data;
        var$14 = $rangeIndex + 1 | 0;
        var$13[$rangeIndex] = otciu_UnicodeHelper$Range__init_0($codePoint, $codePoint + $index | 0, ju_Arrays_copyOf($buffer, $index));
    }
    return ju_Arrays_copyOf0($ranges, var$14);
};
function jl_Object$monitorEnterWait$lambda$_6_0() {
    let a = this; jl_Object.call(a);
    a.$_00 = null;
    a.$_1 = null;
    a.$_2 = 0;
    a.$_3 = null;
}
let jl_Object$monitorEnterWait$lambda$_6_0__init_ = (var$0, var$1, var$2, var$3, var$4) => {
    jl_Object__init_(var$0);
    var$0.$_00 = var$1;
    var$0.$_1 = var$2;
    var$0.$_2 = var$3;
    var$0.$_3 = var$4;
},
jl_Object$monitorEnterWait$lambda$_6_0__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jl_Object$monitorEnterWait$lambda$_6_0();
    jl_Object$monitorEnterWait$lambda$_6_0__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jl_Object$monitorEnterWait$lambda$_6_0_run = var$0 => {
    jl_Object_lambda$monitorEnterWait$0(var$0.$_00, var$0.$_1, var$0.$_2, var$0.$_3);
},
ju_Objects = $rt_classWithoutFields(),
ju_Objects_hashCode = $o => {
    return $o !== null ? $o.$hashCode() : 0;
},
ju_Objects_requireNonNull = $obj => {
    return ju_Objects_requireNonNull0($obj, $rt_s(3));
},
ju_Objects_requireNonNull0 = ($obj, $message) => {
    if ($obj !== null)
        return $obj;
    $rt_throw(jl_NullPointerException__init_($message));
},
ju_Objects_deepEquals = ($a, $b) => {
    if ($a === $b)
        return 1;
    if ($a === null)
        return $b !== null ? 0 : 1;
    if ($rt_isInstance($a, $rt_arraycls($rt_booleancls)))
        return $rt_isInstance($b, $rt_arraycls($rt_booleancls)) && ju_Arrays_equals2($a, $b) ? 1 : 0;
    if ($rt_isInstance($b, $rt_arraycls($rt_booleancls)))
        return 0;
    if ($rt_isInstance($a, $rt_arraycls($rt_bytecls)))
        return $rt_isInstance($b, $rt_arraycls($rt_bytecls)) && ju_Arrays_equals($a, $b) ? 1 : 0;
    if ($rt_isInstance($b, $rt_arraycls($rt_bytecls)))
        return 0;
    if ($rt_isInstance($a, $rt_arraycls($rt_shortcls)))
        return $rt_isInstance($b, $rt_arraycls($rt_shortcls)) && ju_Arrays_equals3($a, $b) ? 1 : 0;
    if ($rt_isInstance($b, $rt_arraycls($rt_shortcls)))
        return 0;
    if ($rt_isInstance($a, $rt_arraycls($rt_intcls)))
        return $rt_isInstance($b, $rt_arraycls($rt_intcls)) && ju_Arrays_equals0($a, $b) ? 1 : 0;
    if ($rt_isInstance($b, $rt_arraycls($rt_intcls)))
        return 0;
    if ($rt_isInstance($a, $rt_arraycls($rt_charcls)))
        return $rt_isInstance($b, $rt_arraycls($rt_charcls)) && ju_Arrays_equals5($a, $b) ? 1 : 0;
    if ($rt_isInstance($b, $rt_arraycls($rt_charcls)))
        return 0;
    if ($rt_isInstance($a, $rt_arraycls($rt_floatcls)))
        return $rt_isInstance($b, $rt_arraycls($rt_floatcls)) && ju_Arrays_equals1($a, $b) ? 1 : 0;
    if ($rt_isInstance($b, $rt_arraycls($rt_floatcls)))
        return 0;
    if ($rt_isInstance($a, $rt_arraycls($rt_doublecls)))
        return $rt_isInstance($b, $rt_arraycls($rt_doublecls)) && ju_Arrays_equals4($a, $b) ? 1 : 0;
    if ($rt_isInstance($b, $rt_arraycls($rt_doublecls)))
        return 0;
    if (!$rt_isInstance($a, $rt_arraycls(jl_Object))) {
        if (!$rt_isInstance($b, $rt_arraycls(jl_Object)))
            return $a.$equals($b);
        return 0;
    }
    return $rt_isInstance($b, $rt_arraycls(jl_Object)) && ju_Arrays_deepEquals($a, $b) ? 1 : 0;
},
ju_Objects_checkFromIndexSize = ($fromIndex, $size, $length) => {
    if ($fromIndex >= 0 && $size >= 0 && $size <= ($length - $fromIndex | 0))
        return $fromIndex;
    $rt_throw(jl_IndexOutOfBoundsException__init_());
};
function ju_TreeMap$TreeNode() {
    let a = this; ju_AbstractMap$SimpleEntry.call(a);
    a.$left = null;
    a.$right = null;
    a.$height = 0;
    a.$size2 = 0;
}
let ju_TreeMap$TreeNode__init_ = ($this, $key) => {
    ju_AbstractMap$SimpleEntry__init_($this, $key, null);
    $this.$height = 1;
    $this.$size2 = 1;
},
ju_TreeMap$TreeNode__init_0 = var_0 => {
    let var_1 = new ju_TreeMap$TreeNode();
    ju_TreeMap$TreeNode__init_(var_1, var_0);
    return var_1;
},
ju_TreeMap$TreeNode_balance = $this => {
    let $factor;
    $factor = $this.$factor();
    if ($factor == 2) {
        if ($this.$right.$factor() < 0)
            $this.$right = $this.$right.$rotateRight();
        return $this.$rotateLeft();
    }
    if ($factor != (-2))
        return $this;
    if ($this.$left.$factor() > 0)
        $this.$left = $this.$left.$rotateLeft();
    return $this.$rotateRight();
},
ju_TreeMap$TreeNode_factor = $this => {
    return ($this.$right === null ? 0 : $this.$right.$height) - ($this.$left === null ? 0 : $this.$left.$height) | 0;
},
ju_TreeMap$TreeNode_rotateRight = $this => {
    let $left;
    $left = $this.$left;
    $this.$left = $left.$right;
    $left.$right = $this;
    $this.$fix();
    $left.$fix();
    return $left;
},
ju_TreeMap$TreeNode_rotateLeft = $this => {
    let $right;
    $right = $this.$right;
    $this.$right = $right.$left;
    $right.$left = $this;
    $this.$fix();
    $right.$fix();
    return $right;
},
ju_TreeMap$TreeNode_fix = $this => {
    let var$1, var$2;
    var$1 = $this.$right === null ? 0 : $this.$right.$height;
    var$2 = $this.$left === null ? 0 : $this.$left.$height;
    $this.$height = jl_Math_max(var$1, var$2) + 1 | 0;
    $this.$size2 = 1;
    if ($this.$left !== null)
        $this.$size2 = $this.$size2 + $this.$left.$size2 | 0;
    if ($this.$right !== null)
        $this.$size2 = $this.$size2 + $this.$right.$size2 | 0;
},
ju_TreeMap$TreeNode_forward = ($this, $reverse) => {
    return $reverse ? $this.$right : $this.$left;
},
ju_TreeMap$TreeNode_down = ($this, $reverse) => {
    return $reverse ? $this.$left : $this.$right;
},
jur_AbstractCharClass$LazyGraph = $rt_classWithoutFields(jur_AbstractCharClass$LazyAlnum),
jur_AbstractCharClass$LazyGraph__init_ = $this => {
    jur_AbstractCharClass$LazyAlnum__init_($this);
},
jur_AbstractCharClass$LazyGraph__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyGraph();
    jur_AbstractCharClass$LazyGraph__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyGraph_computeValue = $this => {
    return (((jur_AbstractCharClass$LazyAlnum_computeValue($this)).$add1(33, 64)).$add1(91, 96)).$add1(123, 126);
},
jur_AbstractCharClass$LazyPrint = $rt_classWithoutFields(jur_AbstractCharClass$LazyGraph),
jur_AbstractCharClass$LazyPrint__init_ = $this => {
    jur_AbstractCharClass$LazyGraph__init_($this);
},
jur_AbstractCharClass$LazyPrint__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyPrint();
    jur_AbstractCharClass$LazyPrint__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyPrint_computeValue = $this => {
    return (jur_AbstractCharClass$LazyGraph_computeValue($this)).$add0(32);
},
jur_AbstractCharClass$LazyJavaSpaceChar = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaSpaceChar__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaSpaceChar__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaSpaceChar();
    jur_AbstractCharClass$LazyJavaSpaceChar__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaSpaceChar_computeValue = $this => {
    return jur_AbstractCharClass$LazyJavaSpaceChar$1__init_0($this);
},
jur_PositiveLookBehind = $rt_classWithoutFields(jur_AtomicJointSet),
jur_PositiveLookBehind__init_ = ($this, $children, $fSet) => {
    jur_AtomicJointSet__init_($this, $children, $fSet);
},
jur_PositiveLookBehind__init_0 = (var_0, var_1) => {
    let var_2 = new jur_PositiveLookBehind();
    jur_PositiveLookBehind__init_(var_2, var_0, var_1);
    return var_2;
},
jur_PositiveLookBehind_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $size, $leftBound, $shift, $i, $e;
    $size = $this.$children.$size();
    $leftBound = !$matchResult.$hasTransparentBounds() ? $matchResult.$getLeftBound() : 0;
    a: {
        $shift = $this.$next3.$matches($stringIndex, $testString, $matchResult);
        if ($shift >= 0) {
            $matchResult.$setConsumed($this.$groupIndex, $stringIndex);
            $i = 0;
            while (true) {
                if ($i >= $size)
                    break a;
                $e = $this.$children.$get0($i);
                if ($e.$findBack($leftBound, $stringIndex, $testString, $matchResult) >= 0) {
                    $matchResult.$setConsumed($this.$groupIndex, (-1));
                    return $shift;
                }
                $i = $i + 1 | 0;
            }
        }
    }
    return (-1);
},
jur_PositiveLookBehind_hasConsumed = ($this, $matchResult) => {
    return 0;
};
function jur_SequenceSet() {
    let a = this; jur_LeafSet.call(a);
    a.$string = null;
    a.$leftToRight = null;
    a.$rightToLeft = null;
}
let jur_SequenceSet__init_ = ($this, $substring) => {
    let $j;
    jur_LeafSet__init_($this);
    $this.$string = $substring.$toString();
    $this.$charCount0 = $substring.$length();
    $this.$leftToRight = jur_SequenceSet$IntHash__init_($this.$charCount0);
    $this.$rightToLeft = jur_SequenceSet$IntHash__init_($this.$charCount0);
    $j = 0;
    while ($j < ($this.$charCount0 - 1 | 0)) {
        $this.$leftToRight.$put0($this.$string.$charAt($j), ($this.$charCount0 - $j | 0) - 1 | 0);
        $this.$rightToLeft.$put0($this.$string.$charAt(($this.$charCount0 - $j | 0) - 1 | 0), ($this.$charCount0 - $j | 0) - 1 | 0);
        $j = $j + 1 | 0;
    }
},
jur_SequenceSet__init_0 = var_0 => {
    let var_1 = new jur_SequenceSet();
    jur_SequenceSet__init_(var_1, var_0);
    return var_1;
},
jur_SequenceSet_accepts = ($this, $strIndex, $testString) => {
    return !$this.$startsWith($testString, $strIndex) ? (-1) : $this.$charCount0;
},
jur_SequenceSet_find = ($this, $strIndex, $testString, $matchResult) => {
    let $strLength, var$5;
    $strLength = $matchResult.$getRightBound();
    while (true) {
        if ($strIndex > $strLength)
            return (-1);
        var$5 = $this.$indexOf($testString, $strIndex, $strLength);
        if (var$5 < 0)
            return (-1);
        if ($this.$next3.$matches(var$5 + $this.$charCount0 | 0, $testString, $matchResult) >= 0)
            break;
        $strIndex = var$5 + 1 | 0;
    }
    return var$5;
},
jur_SequenceSet_findBack = ($this, $strIndex, $lastIndex, $testString, $matchResult) => {
    let var$5;
    while (true) {
        if ($lastIndex < $strIndex)
            return (-1);
        var$5 = $this.$lastIndexOf($testString, $strIndex, $lastIndex);
        if (var$5 < 0)
            return (-1);
        if ($this.$next3.$matches(var$5 + $this.$charCount0 | 0, $testString, $matchResult) >= 0)
            break;
        $lastIndex = var$5 + (-1) | 0;
    }
    return var$5;
},
jur_SequenceSet_first = ($this, $set) => {
    let var$2, var$3, var$4, var$5, var$6;
    if ($set instanceof jur_CharSet)
        return $set.$getChar() != $this.$string.$charAt(0) ? 0 : 1;
    if ($set instanceof jur_RangeSet)
        return $set.$accepts(0, $this.$string.$substring(0, 1)) <= 0 ? 0 : 1;
    if (!($set instanceof jur_SupplRangeSet)) {
        if (!($set instanceof jur_SupplCharSet))
            return 1;
        a: {
            if ($this.$string.$length() > 1) {
                var$2 = $set;
                var$3 = var$2.$getCodePoint();
                var$4 = $this.$string.$charAt(0);
                var$2 = $this.$string;
                var$5 = var$2.$charAt(1);
                if (var$3 == jl_Character_toCodePoint(var$4, var$5)) {
                    var$4 = 1;
                    break a;
                }
            }
            var$4 = 0;
        }
        return var$4;
    }
    b: {
        c: {
            var$2 = $set;
            if (!var$2.$contains0($this.$string.$charAt(0))) {
                var$6 = $this.$string;
                if (var$6.$length() <= 1)
                    break c;
                var$6 = $this.$string;
                var$4 = jl_Character_toCodePoint(var$6.$charAt(0), $this.$string.$charAt(1));
                if (!var$2.$contains0(var$4))
                    break c;
            }
            var$4 = 1;
            break b;
        }
        var$4 = 0;
    }
    return var$4;
},
jur_SequenceSet_indexOf = ($this, $str, $i, $to) => {
    let $last, $ch;
    $last = $this.$string.$charAt($this.$charCount0 - 1 | 0);
    while (true) {
        if ($i > ($to - $this.$charCount0 | 0))
            return (-1);
        $ch = $str.$charAt(($i + $this.$charCount0 | 0) - 1 | 0);
        if ($ch == $last && $this.$startsWith($str, $i))
            break;
        $i = $i + $this.$leftToRight.$get2($ch) | 0;
    }
    return $i;
},
jur_SequenceSet_lastIndexOf = ($this, $str, $to, $i) => {
    let $first, $size, $delta, $ch;
    $first = $this.$string.$charAt(0);
    $size = $str.$length();
    $delta = ($size - $i | 0) - $this.$charCount0 | 0;
    if ($delta <= 0)
        $i = $i + $delta | 0;
    while (true) {
        if ($i < $to)
            return (-1);
        $ch = $str.$charAt($i);
        if ($ch == $first && $this.$startsWith($str, $i))
            break;
        $i = $i - $this.$rightToLeft.$get2($ch) | 0;
    }
    return $i;
},
jur_SequenceSet_startsWith = ($this, $str, $from) => {
    let $i;
    $i = 0;
    while ($i < $this.$charCount0) {
        if ($str.$charAt($i + $from | 0) != $this.$string.$charAt($i))
            return 0;
        $i = $i + 1 | 0;
    }
    return 1;
},
ju_Comparator$NaturalOrder = $rt_classWithoutFields(),
ju_Comparator$NaturalOrder_INSTANCE = null,
ju_Comparator$NaturalOrder_$callClinit = () => {
    ju_Comparator$NaturalOrder_$callClinit = $rt_eraseClinit(ju_Comparator$NaturalOrder);
    ju_Comparator$NaturalOrder__clinit_();
},
ju_Comparator$NaturalOrder__init_ = $this => {
    ju_Comparator$NaturalOrder_$callClinit();
    jl_Object__init_($this);
},
ju_Comparator$NaturalOrder__init_0 = () => {
    let var_0 = new ju_Comparator$NaturalOrder();
    ju_Comparator$NaturalOrder__init_(var_0);
    return var_0;
},
ju_Comparator$NaturalOrder_compare = ($this, $o1, $o2) => {
    return $o1.$compareTo0($o2);
},
ju_Comparator$NaturalOrder_instance = () => {
    ju_Comparator$NaturalOrder_$callClinit();
    return ju_Comparator$NaturalOrder_INSTANCE;
},
ju_Comparator$NaturalOrder__clinit_ = () => {
    ju_Comparator$NaturalOrder_INSTANCE = ju_Comparator$NaturalOrder__init_0();
},
owts_InvalidScrambleException = $rt_classWithoutFields(jl_Exception),
owts_InvalidScrambleException__init_0 = ($this, $scramble, $t) => {
    jl_Exception__init_2($this, (((jl_StringBuilder__init_()).$append1($rt_s(242))).$append1($scramble)).$toString(), $t);
},
owts_InvalidScrambleException__init_ = (var_0, var_1) => {
    let var_2 = new owts_InvalidScrambleException();
    owts_InvalidScrambleException__init_0(var_2, var_0, var_1);
    return var_2;
},
jur_EOISet = $rt_classWithoutFields(jur_AbstractSet),
jur_EOISet__init_ = $this => {
    jur_AbstractSet__init_($this);
},
jur_EOISet__init_0 = () => {
    let var_0 = new jur_EOISet();
    jur_EOISet__init_(var_0);
    return var_0;
},
jur_EOISet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $rightBound;
    $rightBound = !$matchResult.$hasTransparentBounds() ? $matchResult.$getRightBound() : $testString.$length();
    if ($stringIndex < $rightBound)
        return (-1);
    $matchResult.$hitEnd = 1;
    $matchResult.$requireEnd = 1;
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_EOISet_hasConsumed = ($this, $matchResult) => {
    return 0;
},
ju_Queue = $rt_classWithoutFields(0),
jl_ArrayStoreException = $rt_classWithoutFields(jl_RuntimeException),
jl_ArrayStoreException__init_0 = $this => {
    jl_RuntimeException__init_($this);
},
jl_ArrayStoreException__init_ = () => {
    let var_0 = new jl_ArrayStoreException();
    jl_ArrayStoreException__init_0(var_0);
    return var_0;
},
jur_AltGroupQuantifierSet = $rt_classWithoutFields(jur_GroupQuantifierSet),
jur_AltGroupQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_GroupQuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_AltGroupQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_AltGroupQuantifierSet();
    jur_AltGroupQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_AltGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $nextIndex;
    if (!$this.$innerSet.$hasConsumed($matchResult))
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    if ($nextIndex >= 0)
        return $nextIndex;
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_AltGroupQuantifierSet_setNext = ($this, $next) => {
    jur_AbstractSet_setNext($this, $next);
    $this.$innerSet.$setNext($next);
},
jur_AbstractCharClass$LazyUpper = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyUpper__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyUpper__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyUpper();
    jur_AbstractCharClass$LazyUpper__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyUpper_computeValue = $this => {
    return (jur_CharClass__init_()).$add1(65, 90);
},
jur_MatchResult = $rt_classWithoutFields(0);
function jur_MatchResultImpl() {
    let a = this; jl_Object.call(a);
    a.$groupBounds = null;
    a.$consumers = null;
    a.$compQuantCounters = null;
    a.$string3 = null;
    a.$groupCount0 = 0;
    a.$valid = 0;
    a.$leftBound0 = 0;
    a.$rightBound0 = 0;
    a.$startIndex = 0;
    a.$transparentBounds = 0;
    a.$anchoringBounds = 0;
    a.$hitEnd = 0;
    a.$requireEnd = 0;
    a.$previousMatch = 0;
    a.$mode1 = 0;
    a.$namedGroups1 = null;
}
let jur_MatchResultImpl__init_ = ($this, $string, $leftBound, $rightBound, $groupCount, $compQuantCount, $consumersCount, $namedGroups) => {
    let var$8;
    jl_Object__init_($this);
    $this.$previousMatch = (-1);
    var$8 = $groupCount + 1 | 0;
    $this.$groupCount0 = var$8;
    $this.$groupBounds = $rt_createIntArray(var$8 * 2 | 0);
    $this.$namedGroups1 = $namedGroups;
    $this.$consumers = $rt_createIntArray($consumersCount);
    ju_Arrays_fill($this.$consumers, (-1));
    if ($compQuantCount > 0)
        $this.$compQuantCounters = $rt_createIntArray($compQuantCount);
    ju_Arrays_fill($this.$groupBounds, (-1));
    $this.$reset($string, $leftBound, $rightBound);
},
jur_MatchResultImpl__init_0 = (var_0, var_1, var_2, var_3, var_4, var_5, var_6) => {
    let var_7 = new jur_MatchResultImpl();
    jur_MatchResultImpl__init_(var_7, var_0, var_1, var_2, var_3, var_4, var_5, var_6);
    return var_7;
},
jur_MatchResultImpl_setConsumed = ($this, $counter, $value) => {
    $this.$consumers.data[$counter] = $value;
},
jur_MatchResultImpl_getConsumed = ($this, $counter) => {
    return $this.$consumers.data[$counter];
},
jur_MatchResultImpl_end = $this => {
    return $this.$end(0);
},
jur_MatchResultImpl_end0 = ($this, $group) => {
    jur_MatchResultImpl_checkGroup($this, $group);
    return $this.$groupBounds.data[($group * 2 | 0) + 1 | 0];
},
jur_MatchResultImpl_setStart = ($this, $group, $offset) => {
    $this.$groupBounds.data[$group * 2 | 0] = $offset;
},
jur_MatchResultImpl_setEnd = ($this, $group, $offset) => {
    $this.$groupBounds.data[($group * 2 | 0) + 1 | 0] = $offset;
},
jur_MatchResultImpl_getStart = ($this, $group) => {
    return $this.$groupBounds.data[$group * 2 | 0];
},
jur_MatchResultImpl_getEnd = ($this, $group) => {
    return $this.$groupBounds.data[($group * 2 | 0) + 1 | 0];
},
jur_MatchResultImpl_getGroupNoCheck = ($this, $group) => {
    let $st, $end;
    $st = $this.$getStart($group);
    $end = $this.$getEnd($group);
    if (($end | $st | ($end - $st | 0)) >= 0 && $end <= $this.$string3.$length())
        return ($this.$string3.$subSequence($st, $end)).$toString();
    return null;
},
jur_MatchResultImpl_start = $this => {
    return $this.$start(0);
},
jur_MatchResultImpl_start0 = ($this, $group) => {
    jur_MatchResultImpl_checkGroup($this, $group);
    return $this.$groupBounds.data[$group * 2 | 0];
},
jur_MatchResultImpl_finalizeMatch = $this => {
    if ($this.$groupBounds.data[0] == (-1)) {
        $this.$groupBounds.data[0] = $this.$startIndex;
        $this.$groupBounds.data[1] = $this.$startIndex;
    }
    $this.$previousMatch = $this.$end0();
},
jur_MatchResultImpl_getEnterCounter = ($this, $setCounter) => {
    return $this.$compQuantCounters.data[$setCounter];
},
jur_MatchResultImpl_setEnterCounter = ($this, $setCounter, $value) => {
    $this.$compQuantCounters.data[$setCounter] = $value;
},
jur_MatchResultImpl_checkGroup = ($this, $group) => {
    if (!$this.$valid)
        $rt_throw(jl_IllegalStateException__init_1());
    if ($group >= 0 && $group < $this.$groupCount0)
        return;
    $rt_throw(jl_IndexOutOfBoundsException__init_1(jl_String_valueOf0($group)));
},
jur_MatchResultImpl_setValid = $this => {
    $this.$valid = 1;
},
jur_MatchResultImpl_isValid = $this => {
    return $this.$valid;
},
jur_MatchResultImpl_reset0 = ($this, $newSequence, $leftBound, $rightBound) => {
    $this.$valid = 0;
    $this.$mode1 = 2;
    ju_Arrays_fill($this.$groupBounds, (-1));
    ju_Arrays_fill($this.$consumers, (-1));
    if ($newSequence !== null)
        $this.$string3 = $newSequence;
    if ($leftBound >= 0)
        jur_MatchResultImpl_setBounds($this, $leftBound, $rightBound);
    $this.$startIndex = $this.$leftBound0;
},
jur_MatchResultImpl_reset = $this => {
    $this.$reset(null, (-1), (-1));
},
jur_MatchResultImpl_setBounds = ($this, $leftBound, $rightBound) => {
    $this.$leftBound0 = $leftBound;
    $this.$rightBound0 = $rightBound;
},
jur_MatchResultImpl_setStartIndex = ($this, $startIndex) => {
    $this.$startIndex = $startIndex;
    if ($this.$previousMatch >= 0)
        $startIndex = $this.$previousMatch;
    $this.$previousMatch = $startIndex;
},
jur_MatchResultImpl_getLeftBound = $this => {
    return $this.$leftBound0;
},
jur_MatchResultImpl_getRightBound = $this => {
    return $this.$rightBound0;
},
jur_MatchResultImpl_setMode = ($this, $mode) => {
    $this.$mode1 = $mode;
},
jur_MatchResultImpl_mode = $this => {
    return $this.$mode1;
},
jur_MatchResultImpl_useAnchoringBounds = ($this, $value) => {
    $this.$anchoringBounds = $value;
},
jur_MatchResultImpl_hasAnchoringBounds = $this => {
    return $this.$anchoringBounds;
},
jur_MatchResultImpl_hasTransparentBounds = $this => {
    return $this.$transparentBounds;
},
jur_MatchResultImpl_getPreviousMatchEnd = $this => {
    return $this.$previousMatch;
};
function ju_HashMap$AbstractMapIterator() {
    let a = this; jl_Object.call(a);
    a.$position = 0;
    a.$expectedModCount = 0;
    a.$futureEntry = null;
    a.$currentEntry = null;
    a.$prevEntry = null;
    a.$associatedMap = null;
}
let ju_HashMap$AbstractMapIterator__init_ = ($this, $hm) => {
    jl_Object__init_($this);
    $this.$associatedMap = $hm;
    $this.$expectedModCount = $hm.$modCount0;
    $this.$futureEntry = null;
},
ju_HashMap$AbstractMapIterator__init_0 = var_0 => {
    let var_1 = new ju_HashMap$AbstractMapIterator();
    ju_HashMap$AbstractMapIterator__init_(var_1, var_0);
    return var_1;
},
ju_HashMap$AbstractMapIterator_hasNext = $this => {
    if ($this.$futureEntry !== null)
        return 1;
    while ($this.$position < $this.$associatedMap.$elementData.data.length) {
        if ($this.$associatedMap.$elementData.data[$this.$position] !== null)
            return 1;
        $this.$position = $this.$position + 1 | 0;
    }
    return 0;
},
ju_HashMap$AbstractMapIterator_checkConcurrentMod = $this => {
    if ($this.$expectedModCount == $this.$associatedMap.$modCount0)
        return;
    $rt_throw(ju_ConcurrentModificationException__init_());
},
ju_HashMap$AbstractMapIterator_makeNext = $this => {
    let var$1, var$2;
    ju_HashMap$AbstractMapIterator_checkConcurrentMod($this);
    if (!$this.$hasNext())
        $rt_throw(ju_NoSuchElementException__init_());
    if ($this.$futureEntry === null) {
        var$1 = $this.$associatedMap.$elementData.data;
        var$2 = $this.$position;
        $this.$position = var$2 + 1 | 0;
        $this.$currentEntry = var$1[var$2];
        $this.$futureEntry = $this.$currentEntry.$next4;
        $this.$prevEntry = null;
    } else {
        if ($this.$currentEntry !== null)
            $this.$prevEntry = $this.$currentEntry;
        $this.$currentEntry = $this.$futureEntry;
        $this.$futureEntry = $this.$futureEntry.$next4;
    }
},
ju_HashMap$KeyIterator = $rt_classWithoutFields(ju_HashMap$AbstractMapIterator),
ju_HashMap$KeyIterator__init_ = ($this, $map) => {
    ju_HashMap$AbstractMapIterator__init_($this, $map);
},
ju_HashMap$KeyIterator__init_0 = var_0 => {
    let var_1 = new ju_HashMap$KeyIterator();
    ju_HashMap$KeyIterator__init_(var_1, var_0);
    return var_1;
},
ju_HashMap$KeyIterator_next = $this => {
    ju_HashMap$AbstractMapIterator_makeNext($this);
    return $this.$currentEntry.$key;
};
function jur_UCIRangeSet() {
    let a = this; jur_LeafSet.call(a);
    a.$chars1 = null;
    a.$alt2 = 0;
}
let jur_UCIRangeSet__init_ = ($this, $cc) => {
    jur_LeafSet__init_($this);
    $this.$chars1 = $cc.$getInstance();
    $this.$alt2 = $cc.$alt;
},
jur_UCIRangeSet__init_0 = var_0 => {
    let var_1 = new jur_UCIRangeSet();
    jur_UCIRangeSet__init_(var_1, var_0);
    return var_1;
},
jur_UCIRangeSet_accepts = ($this, $strIndex, $testString) => {
    let var$3, var$4;
    var$3 = $this.$chars1;
    var$4 = jl_Character_toUpperCase($testString.$charAt($strIndex));
    return !var$3.$contains0(jl_Character_toLowerCase(var$4)) ? (-1) : 1;
},
owts_InvalidMoveException = $rt_classWithoutFields(jl_Exception),
owts_InvalidMoveException__init_ = ($this, $move) => {
    jl_Exception__init_($this, (((jl_StringBuilder__init_()).$append1($rt_s(243))).$append1($move)).$toString());
},
owts_InvalidMoveException__init_0 = var_0 => {
    let var_1 = new owts_InvalidMoveException();
    owts_InvalidMoveException__init_(var_1, var_0);
    return var_1;
};
function owtp_SkewbPuzzle() {
    owts_Puzzle.call(this);
    this.$skewbSolver = null;
}
let owtp_SkewbPuzzle_l = null,
owtp_SkewbPuzzle_sq3d2 = 0.0,
owtp_SkewbPuzzle_defaultColorScheme = null,
owtp_SkewbPuzzle_$assertionsDisabled = 0,
owtp_SkewbPuzzle_$callClinit = () => {
    owtp_SkewbPuzzle_$callClinit = $rt_eraseClinit(owtp_SkewbPuzzle);
    owtp_SkewbPuzzle__clinit_();
},
owtp_SkewbPuzzle__init_ = $this => {
    owtp_SkewbPuzzle_$callClinit();
    owts_Puzzle__init_($this);
    $this.$skewbSolver = owtp_SkewbSolver__init_0();
    $this.$wcaMinScrambleDistance = 7;
},
owtp_SkewbPuzzle__init_0 = () => {
    let var_0 = new owtp_SkewbPuzzle();
    owtp_SkewbPuzzle__init_(var_0);
    return var_0;
},
owtp_SkewbPuzzle_generateRandomMoves = ($this, $r) => {
    let $state, $scramble, $pState, $e, $$je;
    $state = $this.$skewbSolver.$randomState0($r);
    $scramble = $this.$skewbSolver.$generateExactly0($state, 11, $r);
    owtp_SkewbPuzzle_$callClinit();
    if (!owtp_SkewbPuzzle_$assertionsDisabled && ($scramble.$split($rt_s(16))).data.length != 11)
        $rt_throw(jl_AssertionError__init_());
    a: {
        try {
            $pState = ($this.$getSolvedState()).$applyAlgorithm($scramble);
            break a;
        } catch ($$e) {
            $$je = $rt_wrapException($$e);
            if ($$je instanceof owts_InvalidScrambleException) {
                $e = $$je;
            } else {
                throw $$e;
            }
        }
        $rt_throw(jl_RuntimeException__init_1($e));
    }
    return owts_PuzzleStateAndGenerator__init_($pState, $scramble);
},
owtp_SkewbPuzzle_getSolvedState = $this => {
    return owtp_SkewbPuzzle$SkewbState__init_1($this);
},
owtp_SkewbPuzzle__clinit_ = () => {
    let var$1;
    owtp_SkewbPuzzle_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_SkewbPuzzle)) ? 0 : 1;
    owtp_SkewbPuzzle_l = jul_Logger_getLogger(jl_Class_getName($rt_cls(owtp_SkewbPuzzle)));
    owtp_SkewbPuzzle_sq3d2 = jl_Math_sqrt(3.0) / 2.0;
    owtp_SkewbPuzzle_defaultColorScheme = ju_HashMap__init_();
    var$1 = owtp_SkewbPuzzle_defaultColorScheme;
    owts_Color_$callClinit();
    var$1.$put($rt_s(17), owts_Color_WHITE);
    owtp_SkewbPuzzle_defaultColorScheme.$put($rt_s(20), owts_Color_BLUE);
    owtp_SkewbPuzzle_defaultColorScheme.$put($rt_s(23), owts_Color_RED);
    owtp_SkewbPuzzle_defaultColorScheme.$put($rt_s(62), owts_Color_YELLOW);
    owtp_SkewbPuzzle_defaultColorScheme.$put($rt_s(222), owts_Color_GREEN);
    owtp_SkewbPuzzle_defaultColorScheme.$put($rt_s(228), owts_Color__init_0(16744448));
},
otji_JSWrapper = $rt_classWithoutFields();
function jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1() {
    jur_AbstractCharClass.call(this);
    this.$this$012 = null;
}
let jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1__init_ = ($this, $this$0) => {
    $this.$this$012 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1();
    jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1_contains = ($this, $ch) => {
    return jl_Character_isJavaIdentifierPart($ch);
};
function cm_Search() {
    let a = this; jl_Object.call(a);
    a.$move = null;
    a.$moveSol = null;
    a.$nodeUD = null;
    a.$nodeRL = null;
    a.$nodeFB = null;
    a.$selfSym = Long_ZERO;
    a.$conjMask = 0;
    a.$urfIdx = 0;
    a.$length10 = 0;
    a.$depth1 = 0;
    a.$maxDep2 = 0;
    a.$sol = 0;
    a.$solution1 = null;
    a.$probe = Long_ZERO;
    a.$probeMax = Long_ZERO;
    a.$probeMin = Long_ZERO;
    a.$verbose = 0;
    a.$valid1 = 0;
    a.$allowShorter = 0;
    a.$cc = null;
    a.$urfCubieCube = null;
    a.$urfCoordCube = null;
    a.$phase1Cubie = null;
    a.$preMoveCubes = null;
    a.$preMoves = null;
    a.$preMoveLen = 0;
    a.$maxPreMoves = 0;
    a.$isRec = 0;
}
let cm_Search_MIN_P1LENGTH_PRE = 0,
cm_Search_MAX_DEPTH2 = 0,
cm_Search_inited = 0,
cm_Search_$callClinit = () => {
    cm_Search_$callClinit = $rt_eraseClinit(cm_Search);
    cm_Search__clinit_();
},
cm_Search__init_ = $this => {
    let $i, var$2;
    cm_Search_$callClinit();
    jl_Object__init_($this);
    $this.$move = $rt_createIntArray(31);
    $this.$moveSol = $rt_createIntArray(31);
    $this.$nodeUD = $rt_createArray(cm_CoordCube, 21);
    $this.$nodeRL = $rt_createArray(cm_CoordCube, 21);
    $this.$nodeFB = $rt_createArray(cm_CoordCube, 21);
    $this.$allowShorter = 0;
    $this.$cc = cm_CubieCube__init_();
    $this.$urfCubieCube = $rt_createArray(cm_CubieCube, 6);
    $this.$urfCoordCube = $rt_createArray(cm_CoordCube, 6);
    $this.$phase1Cubie = $rt_createArray(cm_CubieCube, 21);
    $this.$preMoveCubes = $rt_createArray(cm_CubieCube, 21);
    $this.$preMoves = $rt_createIntArray(20);
    $this.$preMoveLen = 0;
    $this.$maxPreMoves = 0;
    $this.$isRec = 0;
    $i = 0;
    while ($i < 21) {
        $this.$nodeUD.data[$i] = cm_CoordCube__init_();
        $this.$nodeRL.data[$i] = cm_CoordCube__init_();
        $this.$nodeFB.data[$i] = cm_CoordCube__init_();
        $this.$phase1Cubie.data[$i] = cm_CubieCube__init_();
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 6) {
        $this.$urfCubieCube.data[$i] = cm_CubieCube__init_();
        $this.$urfCoordCube.data[$i] = cm_CoordCube__init_();
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 20) {
        var$2 = $this.$preMoveCubes.data;
        $i = $i + 1 | 0;
        var$2[$i] = cm_CubieCube__init_();
    }
},
cm_Search__init_0 = () => {
    let var_0 = new cm_Search();
    cm_Search__init_(var_0);
    return var_0;
},
cm_Search_solution = ($this, $facelets, $maxDepth, $probeMax, $probeMin, $verbose) => {
    let $check;
    jl_Object_monitorEnterSync($this);
    try {
        $check = $this.$verify($facelets);
        if ($check)
            return (((jl_StringBuilder__init_()).$append1($rt_s(244))).$append3(jl_Math_abs($check))).$toString();
        $this.$sol = $maxDepth + 1 | 0;
        $this.$probe = Long_ZERO;
        $this.$probeMax = $probeMax;
        $this.$probeMin = jl_Math_min0($probeMin, $probeMax);
        $this.$verbose = $verbose;
        $this.$solution1 = null;
        $this.$isRec = 0;
        cm_CoordCube_init(0);
        $this.$initSearch();
        return $verbose & 8 ? $this.$searchopt() : $this.$search0();
    } finally {
        jl_Object_monitorExitSync($this);
    }
},
cm_Search_initSearch = $this => {
    let $i;
    $this.$conjMask = 0;
    $this.$selfSym = $this.$cc.$selfSymmetry();
    $this.$conjMask = $this.$conjMask | (Long_eq(Long_and(Long_shr($this.$selfSym, 16), Long_fromInt(65535)), Long_ZERO) ? 0 : 18);
    $this.$conjMask = $this.$conjMask | (Long_eq(Long_and(Long_shr($this.$selfSym, 32), Long_fromInt(65535)), Long_ZERO) ? 0 : 36);
    $this.$conjMask = $this.$conjMask | (Long_eq(Long_and(Long_shr($this.$selfSym, 48), Long_fromInt(65535)), Long_ZERO) ? 0 : 56);
    $this.$selfSym = Long_and($this.$selfSym, Long_create(4294967295, 65535));
    $this.$maxPreMoves = $this.$conjMask <= 7 ? 20 : 0;
    $i = 0;
    while ($i < 6) {
        $this.$urfCubieCube.data[$i].$copy($this.$cc);
        $this.$urfCoordCube.data[$i].$setWithPrun($this.$urfCubieCube.data[$i], 20);
        $this.$cc.$URFConjugate();
        if (($i % 3 | 0) == 2)
            $this.$cc.$invCubieCube();
        $i = $i + 1 | 0;
    }
},
cm_Search_init = () => {
    jl_Object_monitorEnterSync($rt_cls(cm_Search));
    try {
        cm_Search_$callClinit();
        if (!cm_Search_inited) {
            cm_CoordCube_init(1);
            cm_Search_inited = 1;
        }
    } finally {
        jl_Object_monitorExitSync($rt_cls(cm_Search));
    }
},
cm_Search_verify = ($this, $facelets) => {
    let $count, $f, $center, var$5, var$6, $i, $$je;
    $count = 0;
    $f = $rt_createByteArray(54);
    a: {
        b: {
            try {
                $center = new jl_String;
                var$5 = $rt_createCharArray(6);
                var$6 = var$5.data;
                var$6[0] = $facelets.$charAt(4);
                var$6[1] = $facelets.$charAt(13);
                var$6[2] = $facelets.$charAt(22);
                var$6[3] = $facelets.$charAt(31);
                var$6[4] = $facelets.$charAt(40);
                var$6[5] = $facelets.$charAt(49);
                jl_String__init_($center, var$5);
                $i = 0;
                while (true) {
                    if ($i >= 54)
                        break a;
                    var$5 = $f.data;
                    var$5[$i] = $center.$indexOf0($facelets.$charAt($i)) << 24 >> 24;
                    if (var$5[$i] == (-1))
                        break;
                    $count = $count + (1 << (var$5[$i] << 2)) | 0;
                    $i = $i + 1 | 0;
                }
            } catch ($$e) {
                $$je = $rt_wrapException($$e);
                if ($$je instanceof jl_Exception) {
                    break b;
                } else {
                    throw $$e;
                }
            }
            return (-1);
        }
        return (-1);
    }
    if ($count != 10066329)
        return (-1);
    cm_Util_toCubieCube($f, $this.$cc);
    return $this.$cc.$verify0();
},
cm_Search_phase1PreMoves = ($this, $maxl, $lm, $cc, $ssym) => {
    let var$5, var$6, $skipMoves, var$8, $m, $ret;
    a: {
        $this.$preMoveLen = $this.$maxPreMoves - $maxl | 0;
        if ($this.$isRec) {
            if ($this.$depth1 != ($this.$length10 - $this.$preMoveLen | 0))
                break a;
        } else if ($this.$preMoveLen && 225207 >> $lm & 1)
            break a;
        $this.$depth1 = $this.$length10 - $this.$preMoveLen | 0;
        $this.$phase1Cubie.data[0] = $cc;
        var$5 = $this.$depth1;
        cm_Search_$callClinit();
        $this.$allowShorter = var$5 == cm_Search_MIN_P1LENGTH_PRE && $this.$preMoveLen ? 1 : 0;
        if ($this.$nodeUD.data[$this.$depth1 + 1 | 0].$setWithPrun($cc, $this.$depth1)) {
            var$6 = $this.$nodeUD.data[$this.$depth1 + 1 | 0];
            var$5 = $this.$depth1;
            if (!$this.$phase1(var$6, $ssym, var$5, (-1)))
                return 0;
        }
    }
    if ($maxl) {
        var$5 = $this.$preMoveLen;
        cm_Search_$callClinit();
        if ((var$5 + cm_Search_MIN_P1LENGTH_PRE | 0) < $this.$length10) {
            $skipMoves = cm_CubieCube_getSkipMoves(Long_fromInt($ssym));
            if (!($maxl != 1 && (($this.$preMoveLen + 1 | 0) + cm_Search_MIN_P1LENGTH_PRE | 0) < $this.$length10))
                $skipMoves = $skipMoves | 225207;
            var$8 = ($lm / 3 | 0) * 3 | 0;
            $m = 0;
            while ($m < 18) {
                if (!($m != var$8 && $m != (var$8 - 9 | 0) && $m != (var$8 + 9 | 0)))
                    $m = $m + 2 | 0;
                else if (!($this.$isRec && $m != $this.$preMoves.data[$this.$maxPreMoves - $maxl | 0]) && !($skipMoves & 1 << $m)) {
                    cm_CubieCube_CornMult(cm_CubieCube_moveCube.data[$m], $cc, $this.$preMoveCubes.data[$maxl]);
                    cm_CubieCube_EdgeMult(cm_CubieCube_moveCube.data[$m], $cc, $this.$preMoveCubes.data[$maxl]);
                    $this.$preMoves.data[$this.$maxPreMoves - $maxl | 0] = $m;
                    $ret = $this.$phase1PreMoves($maxl - 1 | 0, $m, $this.$preMoveCubes.data[$maxl], $ssym & Long_lo(cm_CubieCube_moveCubeSym.data[$m]));
                    if (!$ret)
                        return 0;
                }
                $m = $m + 1 | 0;
            }
            return 1;
        }
    }
    return 1;
},
cm_Search_search = $this => {
    $this.$length10 = !$this.$isRec ? 0 : $this.$length10;
    while ($this.$length10 < $this.$sol) {
        cm_Search_$callClinit();
        $this.$maxDep2 = jl_Math_min(cm_Search_MAX_DEPTH2, ($this.$sol - $this.$length10 | 0) - 1 | 0);
        $this.$urfIdx = !$this.$isRec ? 0 : $this.$urfIdx;
        while ($this.$urfIdx < 6) {
            if (!($this.$conjMask & 1 << $this.$urfIdx) && !$this.$phase1PreMoves($this.$maxPreMoves, (-30), $this.$urfCubieCube.data[$this.$urfIdx], Long_lo(Long_and($this.$selfSym, Long_fromInt(65535)))))
                return $this.$solution1 !== null ? $this.$solution1 : $rt_s(245);
            $this.$urfIdx = $this.$urfIdx + 1 | 0;
        }
        $this.$length10 = $this.$length10 + 1 | 0;
    }
    return $this.$solution1 !== null ? $this.$solution1 : $rt_s(246);
},
cm_Search_initPhase2Pre = $this => {
    let $i, var$2, var$3, var$4, $i_0, $p2corn, $p2csym, var$8, $p2edge, $p2esym, var$11, $p2mid, $edgei, $corni, $lastMove, $lastPre, $ret, $p2switchMax, $p2switch, $p2switchMask, var$21, $m, var$23, var$24, var$25;
    $this.$isRec = 0;
    if (Long_ge($this.$probe, $this.$solution1 !== null ? $this.$probeMin : $this.$probeMax))
        return 0;
    $this.$probe = Long_add($this.$probe, Long_fromInt(1));
    $i = $this.$valid1;
    while ($i < $this.$depth1) {
        var$2 = $this.$phase1Cubie.data[$i];
        cm_CubieCube_$callClinit();
        var$3 = cm_CubieCube_moveCube.data[$this.$move.data[$i]];
        var$4 = $this.$phase1Cubie.data;
        $i_0 = $i + 1 | 0;
        cm_CubieCube_CornMult(var$2, var$3, var$4[$i_0]);
        cm_CubieCube_EdgeMult($this.$phase1Cubie.data[$i], cm_CubieCube_moveCube.data[$this.$move.data[$i]], $this.$phase1Cubie.data[$i_0]);
        $i = $i_0;
    }
    $this.$valid1 = $this.$depth1;
    $p2corn = $this.$phase1Cubie.data[$this.$depth1].$getCPermSym();
    $p2csym = $p2corn & 15;
    var$8 = $p2corn >> 4;
    $p2edge = $this.$phase1Cubie.data[$this.$depth1].$getEPermSym();
    $p2esym = $p2edge & 15;
    var$11 = $p2edge >> 4;
    $p2mid = $this.$phase1Cubie.data[$this.$depth1].$getMPerm();
    $edgei = cm_CubieCube_getPermSymInv(var$11, $p2esym, 0);
    $corni = cm_CubieCube_getPermSymInv(var$8, $p2csym, 1);
    $lastMove = !$this.$depth1 ? (-1) : $this.$move.data[$this.$depth1 - 1 | 0];
    $lastPre = !$this.$preMoveLen ? (-1) : $this.$preMoves.data[$this.$preMoveLen - 1 | 0];
    $ret = 0;
    $p2switchMax = $rt_imul($this.$preMoveLen ? 2 : 1, $this.$depth1 ? 2 : 1);
    $p2switch = 0;
    $p2switchMask = (1 << $p2switchMax) - 1 | 0;
    a: {
        while ($p2switch < $p2switchMax) {
            if ($p2switchMask >> $p2switch & 1) {
                $p2switchMask = $p2switchMask & (1 << $p2switch ^ (-1));
                $ret = $this.$initPhase2(var$8, $p2csym, var$11, $p2esym, $p2mid, $edgei, $corni);
                if (!$ret)
                    break a;
                var$21 = $rt_compare($ret, 2);
                if (var$21 > 0)
                    break a;
                if (!var$21)
                    $p2switchMask = $p2switchMask & 4 << $p2switch;
            }
            if (!$p2switchMask)
                break a;
            if (!($p2switch & 1) && $this.$depth1 > 0) {
                cm_Util_$callClinit();
                $m = cm_Util_std2ud.data[(($lastMove / 3 | 0) * 3 | 0) + 1 | 0];
                $this.$move.data[$this.$depth1 - 1 | 0] = (cm_Util_ud2std.data[$m] * 2 | 0) - $this.$move.data[$this.$depth1 - 1 | 0] | 0;
                cm_CoordCube_$callClinit();
                $p2mid = cm_CoordCube_MPermMove.data[$p2mid].data[$m];
                var$8 = cm_CoordCube_CPermMove.data[var$8].data[cm_CubieCube_SymMoveUD.data[$p2csym].data[$m]];
                $p2csym = cm_CubieCube_SymMult.data[var$8 & 15].data[$p2csym];
                var$8 = var$8 >> 4;
                var$21 = cm_CoordCube_EPermMove.data[var$11].data[cm_CubieCube_SymMoveUD.data[$p2esym].data[$m]];
                $p2esym = cm_CubieCube_SymMult.data[var$21 & 15].data[$p2esym];
                var$11 = var$21 >> 4;
                $corni = cm_CubieCube_getPermSymInv(var$8, $p2csym, 1);
                $edgei = cm_CubieCube_getPermSymInv(var$11, $p2esym, 0);
            } else if ($this.$preMoveLen > 0) {
                cm_Util_$callClinit();
                $m = cm_Util_std2ud.data[(($lastPre / 3 | 0) * 3 | 0) + 1 | 0];
                $this.$preMoves.data[$this.$preMoveLen - 1 | 0] = (cm_Util_ud2std.data[$m] * 2 | 0) - $this.$preMoves.data[$this.$preMoveLen - 1 | 0] | 0;
                var$23 = cm_CubieCube_MPermInv.data;
                cm_CoordCube_$callClinit();
                $p2mid = var$23[cm_CoordCube_MPermMove.data[cm_CubieCube_MPermInv.data[$p2mid]].data[$m]];
                var$24 = cm_CoordCube_CPermMove.data[$corni >> 4].data;
                var$4 = cm_CubieCube_SymMoveUD.data;
                var$11 = $corni & 15;
                var$8 = var$24[var$4[var$11].data[$m]];
                $corni = var$8 & (-16) | cm_CubieCube_SymMult.data[var$8 & 15].data[var$11];
                var$8 = cm_CubieCube_getPermSymInv($corni >> 4, $corni & 15, 1);
                $p2csym = var$8 & 15;
                var$8 = var$8 >> 4;
                var$24 = cm_CoordCube_EPermMove.data[$edgei >> 4].data;
                var$4 = cm_CubieCube_SymMoveUD.data;
                var$21 = $edgei & 15;
                var$25 = var$24[var$4[var$21].data[$m]];
                $edgei = var$25 & (-16) | cm_CubieCube_SymMult.data[var$25 & 15].data[var$21];
                var$21 = cm_CubieCube_getPermSymInv($edgei >> 4, $edgei & 15, 0);
                $p2esym = var$21 & 15;
                var$11 = var$21 >> 4;
            }
            $p2switch = $p2switch + 1 | 0;
        }
    }
    if ($this.$depth1 > 0)
        $this.$move.data[$this.$depth1 - 1 | 0] = $lastMove;
    if ($this.$preMoveLen > 0)
        $this.$preMoves.data[$this.$preMoveLen - 1 | 0] = $lastPre;
    return $ret ? 2 : 0;
},
cm_Search_initPhase2 = ($this, $p2corn, $p2csym, $p2edge, $p2esym, $p2mid, $edgei, $corni) => {
    let var$8, var$9, var$10, var$11, var$12, var$13, $prun, $depth2, $ret, $i;
    cm_CoordCube_$callClinit();
    var$8 = cm_CoordCube_EPermCCombPPrun;
    var$9 = ($edgei >> 4) * 140 | 0;
    var$10 = cm_CoordCube_CCombPConj.data;
    cm_CubieCube_$callClinit();
    var$11 = var$9 + var$10[cm_CubieCube_Perm2CombP.data[$corni >> 4] & 255].data[cm_CubieCube_SymMultInv.data[$edgei & 15].data[$corni & 15]] | 0;
    var$11 = cm_CoordCube_getPruning(var$8, var$11);
    var$12 = cm_CoordCube_EPermCCombPPrun;
    var$13 = ($p2edge * 140 | 0) + cm_CoordCube_CCombPConj.data[cm_CubieCube_Perm2CombP.data[$p2corn] & 255].data[cm_CubieCube_SymMultInv.data[$p2esym].data[$p2csym]] | 0;
    var$13 = cm_CoordCube_getPruning(var$12, var$13);
    var$12 = cm_CoordCube_MCPermPrun;
    var$9 = ($p2corn * 24 | 0) + cm_CoordCube_MPermConj.data[$p2mid].data[$p2csym] | 0;
    var$9 = cm_CoordCube_getPruning(var$12, var$9);
    var$13 = jl_Math_max(var$13, var$9);
    $prun = jl_Math_max(var$11, var$13);
    if ($prun > $this.$maxDep2)
        return $prun - $this.$maxDep2 | 0;
    $depth2 = $this.$maxDep2;
    a: {
        while (true) {
            if ($depth2 < $prun)
                break a;
            $ret = $this.$phase2($p2edge, $p2esym, $p2corn, $p2csym, $p2mid, $depth2, $this.$depth1, 10);
            if ($ret < 0)
                break;
            var$11 = $depth2 - $ret | 0;
            $this.$sol = 0;
            $i = 0;
            while ($i < ($this.$depth1 + var$11 | 0)) {
                $this.$appendSolMove($this.$move.data[$i]);
                $i = $i + 1 | 0;
            }
            $i = $this.$preMoveLen - 1 | 0;
            while ($i >= 0) {
                $this.$appendSolMove($this.$preMoves.data[$i]);
                $i = $i + (-1) | 0;
            }
            $this.$solution1 = $this.$solutionToString();
            $depth2 = var$11 + (-1) | 0;
        }
    }
    if ($depth2 == $this.$maxDep2)
        return 1;
    cm_Search_$callClinit();
    $this.$maxDep2 = jl_Math_min(cm_Search_MAX_DEPTH2, ($this.$sol - $this.$length10 | 0) - 1 | 0);
    return Long_lt($this.$probe, $this.$probeMin) ? 1 : 0;
},
cm_Search_phase1 = ($this, $node, $ssym, $maxl, $lm) => {
    let $ret, $skipMoves, $axis, $power, $m, $prun, var$11;
    if (!$node.$prun && $maxl < 5) {
        if (!$this.$allowShorter && $maxl)
            return 1;
        $this.$depth1 = $this.$depth1 - $maxl | 0;
        $ret = $this.$initPhase2Pre();
        $this.$depth1 = $this.$depth1 + $maxl | 0;
        return $ret;
    }
    $skipMoves = cm_CubieCube_getSkipMoves(Long_fromInt($ssym));
    $axis = 0;
    while ($axis < 18) {
        a: {
            if ($axis != $lm && $axis != ($lm - 9 | 0)) {
                $power = 0;
                while (true) {
                    if ($power >= 3)
                        break a;
                    $m = $axis + $power | 0;
                    if (!($this.$isRec && $m != $this.$move.data[$this.$depth1 - $maxl | 0]) && !($skipMoves && $skipMoves & 1 << $m)) {
                        $prun = $this.$nodeUD.data[$maxl].$doMovePrun($node, $m, 1);
                        var$11 = $rt_compare($prun, $maxl);
                        if (var$11 > 0)
                            break a;
                        if (var$11) {
                            var$11 = $this.$nodeUD.data[$maxl].$doMovePrunConj($node, $m);
                            var$11 = $rt_compare(var$11, $maxl);
                            if (var$11 > 0)
                                break a;
                            if (var$11) {
                                $this.$move.data[$this.$depth1 - $maxl | 0] = $m;
                                $this.$valid1 = jl_Math_min($this.$valid1, $this.$depth1 - $maxl | 0);
                                $ret = $this.$phase1($this.$nodeUD.data[$maxl], $ssym & Long_lo(cm_CubieCube_moveCubeSym.data[$m]), $maxl - 1 | 0, $axis);
                                if (!$ret)
                                    return 0;
                                if ($ret >= 2)
                                    break;
                            }
                        }
                    }
                    $power = $power + 1 | 0;
                }
            }
        }
        $axis = $axis + 3 | 0;
    }
    return 1;
},
cm_Search_searchopt = $this => {
    let $maxprun1, $maxprun2, $i, $ud, $rl, $fb, var$7, var$8;
    $maxprun1 = 0;
    $maxprun2 = 0;
    $i = 0;
    while ($i < 6) {
        $this.$urfCoordCube.data[$i].$calcPruning(0);
        if ($i >= 3)
            $maxprun2 = jl_Math_max($maxprun2, $this.$urfCoordCube.data[$i].$prun);
        else
            $maxprun1 = jl_Math_max($maxprun1, $this.$urfCoordCube.data[$i].$prun);
        $i = $i + 1 | 0;
    }
    $this.$urfIdx = $maxprun2 <= $maxprun1 ? 0 : 3;
    $this.$phase1Cubie.data[0] = $this.$urfCubieCube.data[$this.$urfIdx];
    $this.$length10 = !$this.$isRec ? 0 : $this.$length10;
    while ($this.$length10 < $this.$sol) {
        $ud = $this.$urfCoordCube.data[0 + $this.$urfIdx | 0];
        $rl = $this.$urfCoordCube.data[1 + $this.$urfIdx | 0];
        $fb = $this.$urfCoordCube.data[2 + $this.$urfIdx | 0];
        if ($ud.$prun <= $this.$length10 && $rl.$prun <= $this.$length10 && $fb.$prun <= $this.$length10) {
            var$7 = $this.$selfSym;
            var$8 = $this.$length10;
            if (!$this.$phase1opt($ud, $rl, $fb, var$7, var$8, (-1)))
                return $this.$solution1 !== null ? $this.$solution1 : $rt_s(245);
        }
        $this.$length10 = $this.$length10 + 1 | 0;
    }
    return $this.$solution1 !== null ? $this.$solution1 : $rt_s(246);
},
cm_Search_phase1opt = ($this, $ud, $rl, $fb, $ssym, $maxl, $lm) => {
    let $skipMoves, $axis, $power, $m, var$11, var$12, var$13, $prun_ud, var$15, $prun_rl, $prun_fb, $ret;
    if (!$ud.$prun && !$rl.$prun && !$fb.$prun && $maxl < 5) {
        $this.$maxDep2 = $maxl;
        $this.$depth1 = $this.$length10 - $maxl | 0;
        return $this.$initPhase2Pre() ? 1 : 0;
    }
    $skipMoves = cm_CubieCube_getSkipMoves($ssym);
    $axis = 0;
    while ($axis < 18) {
        a: {
            if ($axis != $lm && $axis != ($lm - 9 | 0)) {
                $power = 0;
                while (true) {
                    if ($power >= 3)
                        break a;
                    $m = $axis + $power | 0;
                    if (!($this.$isRec && $m != $this.$move.data[$this.$length10 - $maxl | 0]) && !($skipMoves && $skipMoves & 1 << $m)) {
                        var$11 = $this.$nodeUD.data[$maxl].$doMovePrun($ud, $m, 0);
                        var$12 = $this.$nodeUD.data[$maxl];
                        var$13 = var$12.$doMovePrunConj($ud, $m);
                        $prun_ud = jl_Math_max(var$11, var$13);
                        var$11 = $rt_compare($prun_ud, $maxl);
                        if (var$11 > 0)
                            break a;
                        if (var$11) {
                            var$15 = cm_CubieCube_urfMove.data[2].data[$m];
                            var$11 = $this.$nodeRL.data[$maxl].$doMovePrun($rl, var$15, 0);
                            var$12 = $this.$nodeRL.data[$maxl];
                            var$13 = var$12.$doMovePrunConj($rl, var$15);
                            $prun_rl = jl_Math_max(var$11, var$13);
                            var$11 = $rt_compare($prun_rl, $maxl);
                            if (var$11 > 0)
                                break a;
                            if (var$11) {
                                var$11 = cm_CubieCube_urfMove.data[2].data[var$15];
                                var$13 = $this.$nodeFB.data[$maxl].$doMovePrun($fb, var$11, 0);
                                var$12 = $this.$nodeFB.data[$maxl];
                                var$15 = var$12.$doMovePrunConj($fb, var$11);
                                $prun_fb = jl_Math_max(var$13, var$15);
                                if ($prun_ud == $prun_rl && $prun_rl == $prun_fb && $prun_fb)
                                    $prun_fb = $prun_fb + 1 | 0;
                                var$13 = $rt_compare($prun_fb, $maxl);
                                if (var$13 > 0)
                                    break;
                                if (var$13) {
                                    var$11 = cm_CubieCube_urfMove.data[2].data[var$11];
                                    $this.$move.data[$this.$length10 - $maxl | 0] = var$11;
                                    $this.$valid1 = jl_Math_min($this.$valid1, $this.$length10 - $maxl | 0);
                                    $ret = $this.$phase1opt($this.$nodeUD.data[$maxl], $this.$nodeRL.data[$maxl], $this.$nodeFB.data[$maxl], Long_and($ssym, cm_CubieCube_moveCubeSym.data[var$11]), $maxl - 1 | 0, $axis);
                                    if (!$ret)
                                        return 0;
                                }
                            }
                        }
                    }
                    $power = $power + 1 | 0;
                }
            }
        }
        $axis = $axis + 3 | 0;
    }
    return 1;
},
cm_Search_appendSolMove = ($this, $curMove) => {
    let var$2, var$3, $axisCur, $axisLast, $pow, var$7;
    if (!$this.$sol) {
        var$2 = $this.$moveSol.data;
        var$3 = $this.$sol;
        $this.$sol = var$3 + 1 | 0;
        var$2[var$3] = $curMove;
        return;
    }
    $axisCur = $curMove / 3 | 0;
    $axisLast = $this.$moveSol.data[$this.$sol - 1 | 0] / 3 | 0;
    if ($axisCur == $axisLast) {
        $pow = ((($curMove % 3 | 0) + ($this.$moveSol.data[$this.$sol - 1 | 0] % 3 | 0) | 0) + 1 | 0) % 4 | 0;
        if ($pow == 3)
            $this.$sol = $this.$sol - 1 | 0;
        else
            $this.$moveSol.data[$this.$sol - 1 | 0] = ($axisCur * 3 | 0) + $pow | 0;
        return;
    }
    if ($this.$sol > 1 && ($axisCur % 3 | 0) == ($axisLast % 3 | 0) && $axisCur == ($this.$moveSol.data[$this.$sol - 2 | 0] / 3 | 0)) {
        $pow = ((($curMove % 3 | 0) + ($this.$moveSol.data[$this.$sol - 2 | 0] % 3 | 0) | 0) + 1 | 0) % 4 | 0;
        if ($pow != 3)
            $this.$moveSol.data[$this.$sol - 2 | 0] = ($axisCur * 3 | 0) + $pow | 0;
        else {
            $this.$moveSol.data[$this.$sol - 2 | 0] = $this.$moveSol.data[$this.$sol - 1 | 0];
            $this.$sol = $this.$sol - 1 | 0;
        }
        return;
    }
    var$2 = $this.$moveSol.data;
    var$7 = $this.$sol;
    $this.$sol = var$7 + 1 | 0;
    var$2[var$7] = $curMove;
},
cm_Search_phase2 = ($this, $edge, $esym, $corn, $csym, $mid, $maxl, $depth, $lm) => {
    let $moveMask, $m, $midx, var$12, $cornx, $csymx, var$15, $edgex, $esymx, var$18, $edgei, $corni, $prun, var$22, var$23, var$24, var$25, $ret;
    if (!$edge && !$corn && !$mid)
        return $maxl;
    cm_Util_$callClinit();
    $moveMask = cm_Util_ckmv2bit.data[$lm];
    $m = 0;
    while ($m < 10) {
        if ($moveMask >> $m & 1)
            $m = $m + (66 >> $m & 3) | 0;
        else {
            cm_CoordCube_$callClinit();
            $midx = cm_CoordCube_MPermMove.data[$mid].data[$m];
            var$12 = cm_CoordCube_CPermMove.data[$corn].data;
            cm_CubieCube_$callClinit();
            $cornx = var$12[cm_CubieCube_SymMoveUD.data[$csym].data[$m]];
            $csymx = cm_CubieCube_SymMult.data[$cornx & 15].data[$csym];
            var$15 = $cornx >> 4;
            $edgex = cm_CoordCube_EPermMove.data[$edge].data[cm_CubieCube_SymMoveUD.data[$esym].data[$m]];
            $esymx = cm_CubieCube_SymMult.data[$edgex & 15].data[$esym];
            var$18 = $edgex >> 4;
            $edgei = cm_CubieCube_getPermSymInv(var$18, $esymx, 0);
            $corni = cm_CubieCube_getPermSymInv(var$15, $csymx, 1);
            $prun = cm_CoordCube_getPruning(cm_CoordCube_EPermCCombPPrun, (($edgei >> 4) * 140 | 0) + cm_CoordCube_CCombPConj.data[cm_CubieCube_Perm2CombP.data[$corni >> 4] & 255].data[cm_CubieCube_SymMultInv.data[$edgei & 15].data[$corni & 15]] | 0);
            if ($prun > ($maxl + 1 | 0))
                return ($maxl - $prun | 0) + 1 | 0;
            if ($prun >= $maxl)
                $m = $m + (66 >> $m & 3 & ($maxl - $prun | 0)) | 0;
            else {
                var$22 = cm_CoordCube_MCPermPrun;
                var$23 = (var$15 * 24 | 0) + cm_CoordCube_MPermConj.data[$midx].data[$csymx] | 0;
                var$23 = cm_CoordCube_getPruning(var$22, var$23);
                var$24 = cm_CoordCube_EPermCCombPPrun;
                var$25 = (var$18 * 140 | 0) + cm_CoordCube_CCombPConj.data[cm_CubieCube_Perm2CombP.data[var$15] & 255].data[cm_CubieCube_SymMultInv.data[$esymx].data[$csymx]] | 0;
                var$25 = cm_CoordCube_getPruning(var$24, var$25);
                var$23 = jl_Math_max(var$23, var$25);
                if (var$23 >= $maxl)
                    $m = $m + (66 >> $m & 3 & ($maxl - var$23 | 0)) | 0;
                else {
                    $ret = $this.$phase2(var$18, $esymx, var$15, $csymx, $midx, $maxl - 1 | 0, $depth + 1 | 0, $m);
                    if ($ret >= 0) {
                        $this.$move.data[$depth] = cm_Util_ud2std.data[$m];
                        return $ret;
                    }
                }
            }
        }
        $m = $m + 1 | 0;
    }
    return (-1);
},
cm_Search_solutionToString = $this => {
    let $sb, $urf, $s, var$4, var$5;
    $sb = jl_StringBuffer__init_();
    $urf = !($this.$verbose & 2) ? $this.$urfIdx : ($this.$urfIdx + 3 | 0) % 6 | 0;
    a: {
        if ($urf >= 3) {
            $s = $this.$sol - 1 | 0;
            while (true) {
                if ($s < 0)
                    break a;
                cm_Util_$callClinit();
                var$4 = cm_Util_move2str.data;
                cm_CubieCube_$callClinit();
                ($sb.$append16(var$4[cm_CubieCube_urfMove.data[$urf].data[$this.$moveSol.data[$s]]])).$append17(32);
                if ($this.$verbose & 1 && $s == $this.$depth1)
                    $sb.$append16($rt_s(247));
                $s = $s + (-1) | 0;
            }
        }
        $s = 0;
        while ($s < $this.$sol) {
            if ($this.$verbose & 1 && $s == $this.$depth1)
                $sb.$append16($rt_s(247));
            cm_Util_$callClinit();
            var$5 = cm_Util_move2str.data;
            cm_CubieCube_$callClinit();
            ($sb.$append16(var$5[cm_CubieCube_urfMove.data[$urf].data[$this.$moveSol.data[$s]]])).$append17(32);
            $s = $s + 1 | 0;
        }
    }
    if ($this.$verbose & 4)
        (($sb.$append16($rt_s(248))).$append18($this.$sol)).$append16($rt_s(249));
    return $sb.$toString();
},
cm_Search__clinit_ = () => {
    cm_Search_MIN_P1LENGTH_PRE = 7;
    cm_Search_MAX_DEPTH2 = 12;
    cm_Search_inited = 0;
};
function jul_Level() {
    let a = this; jl_Object.call(a);
    a.$name4 = null;
    a.$value5 = 0;
}
let jul_Level_OFF = null,
jul_Level_SEVERE = null,
jul_Level_WARNING = null,
jul_Level_INFO = null,
jul_Level_CONFIG = null,
jul_Level_FINE = null,
jul_Level_FINER = null,
jul_Level_FINEST = null,
jul_Level_ALL = null,
jul_Level_$callClinit = () => {
    jul_Level_$callClinit = $rt_eraseClinit(jul_Level);
    jul_Level__clinit_();
},
jul_Level__init_0 = ($this, $name, $value) => {
    jul_Level_$callClinit();
    jl_Object__init_($this);
    $this.$name4 = $name;
    $this.$value5 = $value;
},
jul_Level__init_ = (var_0, var_1) => {
    let var_2 = new jul_Level();
    jul_Level__init_0(var_2, var_0, var_1);
    return var_2;
},
jul_Level_intValue = $this => {
    return $this.$value5;
},
jul_Level__clinit_ = () => {
    jul_Level_OFF = jul_Level__init_($rt_s(250), 2147483647);
    jul_Level_SEVERE = jul_Level__init_($rt_s(251), 1000);
    jul_Level_WARNING = jul_Level__init_($rt_s(252), 900);
    jul_Level_INFO = jul_Level__init_($rt_s(253), 800);
    jul_Level_CONFIG = jul_Level__init_($rt_s(254), 700);
    jul_Level_FINE = jul_Level__init_($rt_s(255), 500);
    jul_Level_FINER = jul_Level__init_($rt_s(256), 400);
    jul_Level_FINEST = jul_Level__init_($rt_s(257), 300);
    jul_Level_ALL = jul_Level__init_($rt_s(258), (-2147483648));
},
ju_AbstractSet = $rt_classWithoutFields(ju_AbstractCollection),
ju_AbstractSet__init_ = $this => {
    ju_AbstractCollection__init_($this);
};
function ju_HashSet() {
    ju_AbstractSet.call(this);
    this.$backingMap = null;
}
let ju_HashSet__init_0 = $this => {
    ju_HashSet__init_($this, ju_HashMap__init_());
},
ju_HashSet__init_1 = () => {
    let var_0 = new ju_HashSet();
    ju_HashSet__init_0(var_0);
    return var_0;
},
ju_HashSet__init_ = ($this, $backingMap) => {
    ju_AbstractSet__init_($this);
    $this.$backingMap = $backingMap;
},
ju_HashSet__init_2 = var_0 => {
    let var_1 = new ju_HashSet();
    ju_HashSet__init_(var_1, var_0);
    return var_1;
},
ju_HashSet_add = ($this, $object) => {
    return $this.$backingMap.$put($object, $this) !== null ? 0 : 1;
},
ju_HashSet_contains = ($this, $object) => {
    return $this.$backingMap.$containsKey($object);
},
otp_Platform = $rt_classWithoutFields(),
otp_Platform_clone = var$1 => {
    let copy = new var$1.constructor();
    for (let field in var$1) {
        if (var$1.hasOwnProperty(field)) {
            copy[field] = var$1[field];
        }
    }
    return copy;
},
otp_Platform_launchThread = var$1 => {
    var$1.$run();
},
otp_Platform_postpone = $runnable => {
    otp_Platform_schedule($runnable, 0);
},
otp_Platform_schedule = (var$1, var$2) => {
    setTimeout(() => {
        otp_Platform_launchThread(var$1);
    }, var$2);
};
function jl_Boolean() {
    jl_Object.call(this);
    this.$value8 = 0;
}
let jl_Boolean_TRUE = null,
jl_Boolean_FALSE = null,
jl_Boolean_TYPE = null,
jl_Boolean_$callClinit = () => {
    jl_Boolean_$callClinit = $rt_eraseClinit(jl_Boolean);
    jl_Boolean__clinit_();
},
jl_Boolean__init_0 = ($this, var$1) => {
    jl_Boolean_$callClinit();
    jl_Object__init_($this);
    $this.$value8 = var$1;
},
jl_Boolean__init_ = var_0 => {
    let var_1 = new jl_Boolean();
    jl_Boolean__init_0(var_1, var_0);
    return var_1;
},
jl_Boolean_hashCode = $value => {
    jl_Boolean_$callClinit();
    return !$value ? 1237 : 1231;
},
jl_Boolean__clinit_ = () => {
    jl_Boolean_TRUE = jl_Boolean__init_(1);
    jl_Boolean_FALSE = jl_Boolean__init_(0);
    jl_Boolean_TYPE = $rt_cls($rt_booleancls);
};
function jur_MultiLineSOLSet() {
    jur_AbstractSet.call(this);
    this.$lt1 = null;
}
let jur_MultiLineSOLSet__init_ = ($this, $lt) => {
    jur_AbstractSet__init_($this);
    $this.$lt1 = $lt;
},
jur_MultiLineSOLSet__init_0 = var_0 => {
    let var_1 = new jur_MultiLineSOLSet();
    jur_MultiLineSOLSet__init_(var_1, var_0);
    return var_1;
},
jur_MultiLineSOLSet_matches = ($this, $strIndex, $testString, $matchResult) => {
    let var$4, var$5;
    a: {
        if ($strIndex != $matchResult.$getRightBound()) {
            if (!$strIndex)
                break a;
            if ($matchResult.$hasAnchoringBounds() && $strIndex == $matchResult.$getLeftBound())
                break a;
            var$4 = $this.$lt1;
            var$5 = $strIndex - 1 | 0;
            if (var$4.$isAfterLineTerminator($testString.$charAt(var$5), $testString.$charAt($strIndex)))
                break a;
        }
        return (-1);
    }
    return $this.$next3.$matches($strIndex, $testString, $matchResult);
},
jur_MultiLineSOLSet_hasConsumed = ($this, $matchResult) => {
    return 0;
},
ju_NoSuchElementException = $rt_classWithoutFields(jl_RuntimeException),
ju_NoSuchElementException__init_0 = $this => {
    jl_RuntimeException__init_($this);
},
ju_NoSuchElementException__init_ = () => {
    let var_0 = new ju_NoSuchElementException();
    ju_NoSuchElementException__init_0(var_0);
    return var_0;
},
ju_List = $rt_classWithoutFields(0);
function ju_AbstractList() {
    ju_AbstractCollection.call(this);
    this.$modCount = 0;
}
let ju_AbstractList__init_ = $this => {
    ju_AbstractCollection__init_($this);
},
ju_AbstractList_iterator = $this => {
    return ju_AbstractList$1__init_0($this);
},
ju_AbstractSequentialList = $rt_classWithoutFields(ju_AbstractList),
ju_AbstractSequentialList__init_ = $this => {
    ju_AbstractList__init_($this);
},
ju_Deque = $rt_classWithoutFields(0);
function ju_LinkedList() {
    let a = this; ju_AbstractSequentialList.call(a);
    a.$firstEntry = null;
    a.$lastEntry = null;
    a.$size3 = 0;
}
let ju_LinkedList__init_ = $this => {
    ju_AbstractSequentialList__init_($this);
},
ju_LinkedList__init_0 = () => {
    let var_0 = new ju_LinkedList();
    ju_LinkedList__init_(var_0);
    return var_0;
},
ju_LinkedList_size = $this => {
    return $this.$size3;
},
ju_LinkedList_addLast = ($this, $e) => {
    let $entry;
    $entry = ju_LinkedList$Entry__init_0();
    $entry.$item = $e;
    $entry.$previous = $this.$lastEntry;
    if ($this.$lastEntry === null)
        $this.$firstEntry = $entry;
    else
        $this.$lastEntry.$next6 = $entry;
    $this.$lastEntry = $entry;
    $this.$modCount = $this.$modCount + 1 | 0;
    $this.$size3 = $this.$size3 + 1 | 0;
},
ju_LinkedList_removeLast = $this => {
    if (!$this.$isEmpty())
        return $this.$pollLast();
    $rt_throw(ju_NoSuchElementException__init_());
},
ju_LinkedList_pollLast = $this => {
    let $entry;
    if ($this.$lastEntry === null)
        return null;
    $entry = $this.$lastEntry;
    $this.$lastEntry = $this.$lastEntry.$previous;
    if ($this.$lastEntry === null)
        $this.$firstEntry = null;
    else
        $this.$lastEntry.$next6 = null;
    $this.$size3 = $this.$size3 - 1 | 0;
    $this.$modCount = $this.$modCount + 1 | 0;
    return $entry.$item;
},
jlr_AnnotatedElement = $rt_classWithoutFields(0),
jlr_GenericDeclaration = $rt_classWithoutFields(0);
function owts_AlgorithmBuilder() {
    let a = this; jl_Object.call(a);
    a.$moves = null;
    a.$states = null;
    a.$originalState = null;
    a.$unNormalizedState = null;
    a.$totalCost = 0;
    a.$mergingMode = null;
}
let owts_AlgorithmBuilder_l = null,
owts_AlgorithmBuilder_$assertionsDisabled = 0,
owts_AlgorithmBuilder_$callClinit = () => {
    owts_AlgorithmBuilder_$callClinit = $rt_eraseClinit(owts_AlgorithmBuilder);
    owts_AlgorithmBuilder__clinit_();
},
owts_AlgorithmBuilder__init_ = ($this, $puzzle, $mergingMode) => {
    owts_AlgorithmBuilder_$callClinit();
    owts_AlgorithmBuilder__init_0($this, $mergingMode, $puzzle.$getSolvedState());
},
owts_AlgorithmBuilder__init_2 = (var_0, var_1) => {
    let var_2 = new owts_AlgorithmBuilder();
    owts_AlgorithmBuilder__init_(var_2, var_0, var_1);
    return var_2;
},
owts_AlgorithmBuilder__init_0 = ($this, $mergingMode, $originalState) => {
    owts_AlgorithmBuilder_$callClinit();
    jl_Object__init_($this);
    $this.$moves = ju_ArrayList__init_();
    $this.$states = ju_ArrayList__init_();
    $this.$mergingMode = $mergingMode;
    owts_AlgorithmBuilder_resetToState($this, $originalState);
},
owts_AlgorithmBuilder__init_1 = (var_0, var_1) => {
    let var_2 = new owts_AlgorithmBuilder();
    owts_AlgorithmBuilder__init_0(var_2, var_0, var_1);
    return var_2;
},
owts_AlgorithmBuilder_resetToState = ($this, $originalState) => {
    $this.$totalCost = 0;
    $this.$originalState = $originalState;
    $this.$unNormalizedState = $originalState;
    $this.$moves.$clear();
    $this.$states.$clear();
    $this.$states.$add($this.$unNormalizedState);
},
owts_AlgorithmBuilder_findBestIndexForMove = ($this, $move, $mergingMode) => {
    let $newUnNormalizedState, $newNormalizedState, $successors, var$6, var$7, $ps, $lastMoveIndex, $lastMove, $stateBeforeLastMove, $stateAfterLastMove, $stateAfterLastMoveAndNewMove, var$14, $alternateLastMove;
    owts_AlgorithmBuilder$MergingMode_$callClinit();
    if ($mergingMode === owts_AlgorithmBuilder$MergingMode_NO_MERGING)
        return owts_AlgorithmBuilder$IndexAndMove__init_($this.$moves.$size(), $move);
    $newUnNormalizedState = $this.$unNormalizedState.$apply($move);
    if ($newUnNormalizedState.$equalsNormalized($this.$unNormalizedState) && $mergingMode === owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES)
        return owts_AlgorithmBuilder$IndexAndMove__init_(0, null);
    $newNormalizedState = $newUnNormalizedState.$getNormalized();
    $successors = ($this.$getState()).$getCanonicalMovesByState();
    var$6 = null;
    var$7 = ($successors.$keySet()).$iterator();
    a: {
        while (var$7.$hasNext()) {
            $ps = var$7.$next();
            if ($ps.$equalsNormalized($newNormalizedState)) {
                var$6 = $successors.$get($ps);
                break a;
            }
        }
    }
    if (!owts_AlgorithmBuilder_$assertionsDisabled && var$6 === null)
        $rt_throw(jl_AssertionError__init_());
    b: {
        if ($mergingMode === owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES) {
            $lastMoveIndex = $this.$moves.$size() - 1 | 0;
            while (true) {
                if ($lastMoveIndex < 0)
                    break b;
                $lastMove = $this.$moves.$get0($lastMoveIndex);
                $stateBeforeLastMove = $this.$states.$get0($lastMoveIndex);
                if (!$stateBeforeLastMove.$movesCommute($lastMove, var$6))
                    break b;
                $stateAfterLastMove = $this.$states.$get0($lastMoveIndex + 1 | 0);
                $stateAfterLastMoveAndNewMove = $stateAfterLastMove.$apply(var$6);
                if ($stateBeforeLastMove.$equalsNormalized($stateAfterLastMoveAndNewMove))
                    break;
                var$7 = $stateBeforeLastMove.$getCanonicalMovesByState();
                var$14 = (var$7.$keySet()).$iterator();
                while (var$14.$hasNext()) {
                    $ps = var$14.$next();
                    if ($ps.$equalsNormalized($stateAfterLastMoveAndNewMove)) {
                        $alternateLastMove = var$7.$get($ps);
                        return owts_AlgorithmBuilder$IndexAndMove__init_($lastMoveIndex, $alternateLastMove);
                    }
                }
                $lastMoveIndex = $lastMoveIndex + (-1) | 0;
            }
            return owts_AlgorithmBuilder$IndexAndMove__init_($lastMoveIndex, null);
        }
    }
    return owts_AlgorithmBuilder$IndexAndMove__init_($this.$moves.$size(), var$6);
},
owts_AlgorithmBuilder_appendMove = ($this, $newMove) => {
    let $indexAndMove, $oldCostMove, $newCostMove, var$5, $i, var$7, var$8;
    owts_AlgorithmBuilder_$callClinit();
    owts_AlgorithmBuilder_l.$fine(((((jl_StringBuilder__init_()).$append1($rt_s(259))).$append1($newMove)).$append1($rt_s(260))).$toString());
    $indexAndMove = $this.$findBestIndexForMove($newMove, $this.$mergingMode);
    if ($indexAndMove.$index0 >= $this.$moves.$size()) {
        $oldCostMove = 0;
        $newCostMove = ($this.$states.$get0($this.$states.$size() - 1 | 0)).$getMoveCost($indexAndMove.$move0);
        $this.$moves.$add($indexAndMove.$move0);
        $this.$states.$add(null);
    } else {
        if (!owts_AlgorithmBuilder_$assertionsDisabled) {
            var$5 = $this.$mergingMode;
            owts_AlgorithmBuilder$MergingMode_$callClinit();
            if (var$5 === owts_AlgorithmBuilder$MergingMode_NO_MERGING)
                $rt_throw(jl_AssertionError__init_());
        }
        $oldCostMove = ($this.$states.$get0($indexAndMove.$index0)).$getMoveCost($this.$moves.$get0($indexAndMove.$index0));
        if ($indexAndMove.$move0 === null) {
            $this.$moves.$remove0($indexAndMove.$index0);
            $this.$states.$remove0($indexAndMove.$index0 + 1 | 0);
            $newCostMove = 0;
        } else {
            $this.$moves.$set0($indexAndMove.$index0, $indexAndMove.$move0);
            $newCostMove = ($this.$states.$get0($indexAndMove.$index0)).$getMoveCost($indexAndMove.$move0);
        }
    }
    $this.$totalCost = $this.$totalCost + ($newCostMove - $oldCostMove | 0) | 0;
    $i = $indexAndMove.$index0 + 1 | 0;
    while ($i < $this.$states.$size()) {
        var$5 = $this.$states;
        var$7 = $this.$states;
        var$8 = $i - 1 | 0;
        var$5.$set0($i, (var$7.$get0(var$8)).$apply($this.$moves.$get0(var$8)));
        $i = $i + 1 | 0;
    }
    $this.$unNormalizedState = $this.$unNormalizedState.$apply($newMove);
    if (!owts_AlgorithmBuilder_$assertionsDisabled && $this.$states.$size() != ($this.$moves.$size() + 1 | 0))
        $rt_throw(jl_AssertionError__init_());
    if (!owts_AlgorithmBuilder_$assertionsDisabled && !$this.$unNormalizedState.$equalsNormalized($this.$getState()))
        $rt_throw(jl_AssertionError__init_());
},
owts_AlgorithmBuilder_appendAlgorithm = ($this, $algorithm) => {
    let var$2, var$3, var$4, $move;
    var$2 = (owts_AlgorithmBuilder_splitAlgorithm($algorithm)).data;
    var$3 = var$2.length;
    var$4 = 0;
    while (var$4 < var$3) {
        $move = var$2[var$4];
        $this.$appendMove($move);
        var$4 = var$4 + 1 | 0;
    }
},
owts_AlgorithmBuilder_getState = $this => {
    owts_AlgorithmBuilder_$callClinit();
    if (!owts_AlgorithmBuilder_$assertionsDisabled && $this.$states.$size() != ($this.$moves.$size() + 1 | 0))
        $rt_throw(jl_AssertionError__init_());
    return $this.$states.$get0($this.$states.$size() - 1 | 0);
},
owts_AlgorithmBuilder_toString = $this => {
    return jl_String_join($rt_s(16), $this.$moves);
},
owts_AlgorithmBuilder_getStateAndGenerator = $this => {
    return owts_PuzzleStateAndGenerator__init_($this.$getState(), $this.$toString());
},
owts_AlgorithmBuilder_splitAlgorithm = $algorithm => {
    owts_AlgorithmBuilder_$callClinit();
    if (!($algorithm.$trim()).$isEmpty())
        return $algorithm.$split($rt_s(261));
    return $rt_createArray(jl_String, 0);
},
owts_AlgorithmBuilder__clinit_ = () => {
    owts_AlgorithmBuilder_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owts_AlgorithmBuilder)) ? 0 : 1;
    owts_AlgorithmBuilder_l = jul_Logger_getLogger(jl_Class_getName($rt_cls(owts_AlgorithmBuilder)));
},
jur_NegativeLookBehind = $rt_classWithoutFields(jur_AtomicJointSet),
jur_NegativeLookBehind__init_ = ($this, $children, $fSet) => {
    jur_AtomicJointSet__init_($this, $children, $fSet);
},
jur_NegativeLookBehind__init_0 = (var_0, var_1) => {
    let var_2 = new jur_NegativeLookBehind();
    jur_NegativeLookBehind__init_(var_2, var_0, var_1);
    return var_2;
},
jur_NegativeLookBehind_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $size, $i, $e, $shift;
    $size = $this.$children.$size();
    $matchResult.$setConsumed($this.$groupIndex, $stringIndex);
    $i = 0;
    while (true) {
        if ($i >= $size)
            return $this.$next3.$matches($stringIndex, $testString, $matchResult);
        $e = $this.$children.$get0($i);
        $shift = $e.$findBack(0, $stringIndex, $testString, $matchResult);
        if ($shift >= 0)
            break;
        $i = $i + 1 | 0;
    }
    return (-1);
},
jur_NegativeLookBehind_hasConsumed = ($this, $matchResult) => {
    return 0;
},
jur_BackReferenceSet = $rt_classWithoutFields(jur_CIBackReferenceSet),
jur_BackReferenceSet__init_ = ($this, $groupIndex, $consCounter) => {
    jur_CIBackReferenceSet__init_($this, $groupIndex, $consCounter);
},
jur_BackReferenceSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_BackReferenceSet();
    jur_BackReferenceSet__init_(var_2, var_0, var_1);
    return var_2;
},
jur_BackReferenceSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $group, $shift;
    $group = $this.$getString($matchResult);
    if ($group !== null && ($stringIndex + $group.$length() | 0) <= $matchResult.$getRightBound()) {
        $shift = !($testString.$toString()).$startsWith0($group, $stringIndex) ? (-1) : $group.$length();
        if ($shift < 0)
            return (-1);
        $matchResult.$setConsumed($this.$consCounter1, $shift);
        return $this.$next3.$matches($stringIndex + $shift | 0, $testString, $matchResult);
    }
    return (-1);
},
jur_BackReferenceSet_find = ($this, $strIndex, $testString, $matchResult) => {
    let $group, $strLength, $testStr, var$7;
    $group = $this.$getString($matchResult);
    $strLength = $matchResult.$getLeftBound();
    if ($group !== null && ($strIndex + $group.$length() | 0) <= $strLength) {
        $testStr = $testString.$toString();
        while (true) {
            if ($strIndex > $strLength)
                return (-1);
            var$7 = $testStr.$indexOf1($group, $strIndex);
            if (var$7 < 0)
                return (-1);
            if ($this.$next3.$matches(var$7 + $group.$length() | 0, $testString, $matchResult) >= 0)
                break;
            $strIndex = var$7 + 1 | 0;
        }
        return var$7;
    }
    return (-1);
},
jur_BackReferenceSet_findBack = ($this, $strIndex, $lastIndex, $testString, $matchResult) => {
    let $group, $testStr, var$7;
    $group = $this.$getString($matchResult);
    if ($group === null)
        return (-1);
    $testStr = $testString.$toString();
    a: {
        while (true) {
            if ($lastIndex < $strIndex)
                return (-1);
            var$7 = $testStr.$lastIndexOf0($group, $lastIndex);
            if (var$7 < 0)
                break a;
            if (var$7 < $strIndex)
                break a;
            if ($this.$next3.$matches(var$7 + $group.$length() | 0, $testString, $matchResult) >= 0)
                break;
            $lastIndex = var$7 + (-1) | 0;
        }
        return var$7;
    }
    return (-1);
},
jur_BackReferenceSet_first = ($this, $set) => {
    return 1;
},
jur_AbstractCharClass$LazyLower = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyLower__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyLower__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyLower();
    jur_AbstractCharClass$LazyLower__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyLower_computeValue = $this => {
    return (jur_CharClass__init_()).$add1(97, 122);
},
oti_AsyncCallback = $rt_classWithoutFields(0);
function jur_DotQuantifierSet() {
    jur_QuantifierSet.call(this);
    this.$lt = null;
}
let jur_DotQuantifierSet__init_ = ($this, $innerSet, $next, $type, $lt) => {
    jur_QuantifierSet__init_($this, $innerSet, $next, $type);
    $this.$lt = $lt;
},
jur_DotQuantifierSet__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_DotQuantifierSet();
    jur_DotQuantifierSet__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_DotQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength, $startSearch;
    $strLength = $matchResult.$getRightBound();
    $startSearch = jur_DotQuantifierSet_findLineTerminator($this, $stringIndex, $strLength, $testString);
    if ($startSearch >= 0)
        $strLength = $startSearch;
    if ($strLength > $stringIndex)
        return $this.$next3.$findBack($stringIndex, $strLength, $testString, $matchResult);
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_DotQuantifierSet_find = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength, $res, $nextSearch, var$7, $leftBound;
    $strLength = $matchResult.$getRightBound();
    $res = $this.$next3.$find($stringIndex, $testString, $matchResult);
    if ($res < 0)
        return (-1);
    $nextSearch = jur_DotQuantifierSet_findLineTerminator($this, $res, $strLength, $testString);
    if ($nextSearch >= 0)
        $strLength = $nextSearch;
    var$7 = $this.$next3.$findBack($res, $strLength, $testString, $matchResult);
    var$7 = jl_Math_max($res, var$7);
    $leftBound = var$7 > 0 ? jur_DotQuantifierSet_findBackLineTerminator($this, $stringIndex, var$7 - 1 | 0, $testString) : var$7 ? (-1) : 0;
    if ($leftBound >= $stringIndex)
        $stringIndex = $leftBound >= var$7 ? $leftBound : $leftBound + 1 | 0;
    return $stringIndex;
},
jur_DotQuantifierSet_findLineTerminator = ($this, $i, $to, $testString) => {
    while (true) {
        if ($i >= $to)
            return (-1);
        if ($this.$lt.$isLineTerminator($testString.$charAt($i)))
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
jur_DotQuantifierSet_findBackLineTerminator = ($this, $from, $i, $testString) => {
    while (true) {
        if ($i < $from)
            return (-1);
        if ($this.$lt.$isLineTerminator($testString.$charAt($i)))
            break;
        $i = $i + (-1) | 0;
    }
    return $i;
},
jur_AbstractCharClass$LazyJavaJavaIdentifierPart = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaJavaIdentifierPart__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaJavaIdentifierPart__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaJavaIdentifierPart();
    jur_AbstractCharClass$LazyJavaJavaIdentifierPart__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaJavaIdentifierPart_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
},
jur_AbstractCharClass$LazyJavaTitleCase = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaTitleCase__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaTitleCase__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaTitleCase();
    jur_AbstractCharClass$LazyJavaTitleCase__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaTitleCase_computeValue = $this => {
    return jur_AbstractCharClass$LazyJavaTitleCase$1__init_0($this);
},
jur_PreviousMatch = $rt_classWithoutFields(jur_AbstractSet),
jur_PreviousMatch__init_ = $this => {
    jur_AbstractSet__init_($this);
},
jur_PreviousMatch__init_0 = () => {
    let var_0 = new jur_PreviousMatch();
    jur_PreviousMatch__init_(var_0);
    return var_0;
},
jur_PreviousMatch_matches = ($this, $stringIndex, $testString, $matchResult) => {
    if ($stringIndex != $matchResult.$getPreviousMatchEnd())
        return (-1);
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_PreviousMatch_hasConsumed = ($this, $matchResult) => {
    return 0;
},
jur_UnifiedQuantifierSet = $rt_classWithoutFields(jur_LeafQuantifierSet),
jur_UnifiedQuantifierSet__init_ = ($this, $quant) => {
    jur_LeafQuantifierSet__init_($this, $quant.$getInnerSet(), $quant.$getNext(), $quant.$getType());
    $this.$innerSet.$setNext($this);
},
jur_UnifiedQuantifierSet__init_0 = var_0 => {
    let var_1 = new jur_UnifiedQuantifierSet();
    jur_UnifiedQuantifierSet__init_(var_1, var_0);
    return var_1;
},
jur_UnifiedQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let var$4;
    while (($stringIndex + $this.$leaf.$charCount() | 0) <= $matchResult.$getRightBound()) {
        var$4 = $this.$leaf;
        if (var$4.$accepts($stringIndex, $testString) <= 0)
            break;
        $stringIndex = $stringIndex + $this.$leaf.$charCount() | 0;
    }
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_UnifiedQuantifierSet_find = ($this, $stringIndex, $testString, $matchResult) => {
    let $startSearch, $newSearch, $newSearch_0;
    $startSearch = $this.$next3.$find($stringIndex, $testString, $matchResult);
    if ($startSearch < 0)
        return (-1);
    $newSearch = $startSearch - $this.$leaf.$charCount() | 0;
    while ($newSearch >= $stringIndex && $this.$leaf.$accepts($newSearch, $testString) > 0) {
        $newSearch_0 = $newSearch - $this.$leaf.$charCount() | 0;
        $startSearch = $newSearch;
        $newSearch = $newSearch_0;
    }
    return $startSearch;
},
jlr_Type = $rt_classWithoutFields(0);
function jl_Class() {
    let a = this; jl_Object.call(a);
    a.$flags1 = 0;
    a.$classInfo = null;
    a.$name1 = null;
}
let jl_Class__init_0 = ($this, $classInfo) => {
    jl_Object__init_($this);
    $this.$classInfo = $classInfo;
},
jl_Class__init_ = var_0 => {
    let var_1 = new jl_Class();
    jl_Class__init_0(var_1, var_0);
    return var_1;
},
jl_Class_createClass = $classInfo => {
    return jl_Class__init_($classInfo);
},
jl_Class_toString = $this => {
    let var$1, var$2, var$3;
    var$1 = jl_Class_isInterface($this) ? $rt_s(262) : !jl_Class_isPrimitive($this) ? $rt_s(263) : $rt_s(3);
    var$2 = jl_Class_getName($this);
    var$3 = jl_StringBuilder__init_();
    jl_StringBuilder_append(jl_StringBuilder_append(var$3, var$1), var$2);
    return jl_StringBuilder_toString(var$3);
},
jl_Class_getClassInfo = $this => {
    return $this.$classInfo;
},
jl_Class_isInstance = ($this, $obj) => {
    return $obj !== null && jl_Class_isAssignableFrom($this, jl_Object_getClass($obj)) ? 1 : 0;
},
jl_Class_isAssignableFrom = ($this, $obj) => {
    return $rt_isAssignable($obj.$classInfo, $this.$classInfo);
},
jl_Class_getName = $this => {
    let $metadataName, $result, $itemType, $itemName, var$5;
    if (!($this.$flags1 & 1)) {
        $this.$flags1 = $this.$flags1 | 1;
        $metadataName = $this.$classInfo[$rt_meta].name;
        $result = $metadataName === null ? null : $rt_str($metadataName);
        if ($result === null) {
            $itemType = $this.$classInfo[$rt_meta].itemType;
            if ($itemType !== null) {
                $itemName = jl_Class_getName($rt_cls($itemType));
                if ($itemName !== null) {
                    if ($itemType[$rt_meta].itemType !== null) {
                        var$5 = jl_StringBuilder__init_();
                        jl_StringBuilder_append(jl_StringBuilder_append0(var$5, 91), $itemName);
                        $result = jl_StringBuilder_toString(var$5);
                    } else {
                        var$5 = jl_StringBuilder__init_();
                        jl_StringBuilder_append0(jl_StringBuilder_append(jl_StringBuilder_append(var$5, $rt_s(264)), $itemName), 59);
                        $result = jl_StringBuilder_toString(var$5);
                    }
                }
            }
        }
        $this.$name1 = $result;
    }
    return $this.$name1;
},
jl_Class_isPrimitive = $this => {
    return !$this.$classInfo[$rt_meta].primitiveKind ? 0 : 1;
},
jl_Class_isEnum = $this => {
    return !($this.$classInfo[$rt_meta].modifiers & 65536) ? 0 : 1;
},
jl_Class_isInterface = $this => {
    return !($this.$classInfo[$rt_meta].modifiers & 512) ? 0 : 1;
},
jl_Class_getComponentType = $this => {
    let $itemTypeInfo;
    $itemTypeInfo = $this.$classInfo[$rt_meta].itemType;
    return $itemTypeInfo === null ? null : $rt_cls($itemTypeInfo);
},
jl_Class_desiredAssertionStatus = $this => {
    return 1;
},
jl_Class_getEnumConstants = $this => {
    let $count, $data, $i;
    if (!jl_Class_isEnum($this))
        return null;
    jl_Class_initialize($this);
    $count = $rt_enumConstants($this.$classInfo).length;
    $data = otrr_ClassInfo_newArrayInstance($this.$classInfo, $count);
    $i = 0;
    while ($i < $count) {
        $data.data[$i] = $rt_enumConstants($this.$classInfo)[$i];
        $i = $i + 1 | 0;
    }
    return $data;
},
jl_Class_initialize = $this => {
    $this.$classInfo[$rt_meta].clinit();
};
function owtp_PyraminxSolver$PyraminxSolverState() {
    let a = this; jl_Object.call(a);
    a.$edgePerm = 0;
    a.$edgeOrient = 0;
    a.$cornerOrient = 0;
    a.$tips = 0;
}
let owtp_PyraminxSolver$PyraminxSolverState_$assertionsDisabled = 0,
owtp_PyraminxSolver$PyraminxSolverState_$callClinit = () => {
    owtp_PyraminxSolver$PyraminxSolverState_$callClinit = $rt_eraseClinit(owtp_PyraminxSolver$PyraminxSolverState);
    owtp_PyraminxSolver$PyraminxSolverState__clinit_();
},
owtp_PyraminxSolver$PyraminxSolverState__init_0 = $this => {
    owtp_PyraminxSolver$PyraminxSolverState_$callClinit();
    jl_Object__init_($this);
},
owtp_PyraminxSolver$PyraminxSolverState__init_ = () => {
    let var_0 = new owtp_PyraminxSolver$PyraminxSolverState();
    owtp_PyraminxSolver$PyraminxSolverState__init_0(var_0);
    return var_0;
},
owtp_PyraminxSolver$PyraminxSolverState_unsolvedTips = $this => {
    let $numberUnsolved, $tempTips;
    $numberUnsolved = 0;
    $tempTips = $this.$tips;
    while ($tempTips) {
        if (($tempTips % 3 | 0) > 0)
            $numberUnsolved = $numberUnsolved + 1 | 0;
        $tempTips = $tempTips / 3 | 0;
    }
    owtp_PyraminxSolver$PyraminxSolverState_$callClinit();
    if (!owtp_PyraminxSolver$PyraminxSolverState_$assertionsDisabled && $numberUnsolved > 4)
        $rt_throw(jl_AssertionError__init_());
    return $numberUnsolved;
},
owtp_PyraminxSolver$PyraminxSolverState__clinit_ = () => {
    owtp_PyraminxSolver$PyraminxSolverState_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_PyraminxSolver)) ? 0 : 1;
};
function ju_BitSet() {
    let a = this; jl_Object.call(a);
    a.$data = null;
    a.$length0 = 0;
}
let ju_BitSet__init_0 = $this => {
    jl_Object__init_($this);
    $this.$data = $rt_createIntArray(2);
},
ju_BitSet__init_1 = () => {
    let var_0 = new ju_BitSet();
    ju_BitSet__init_0(var_0);
    return var_0;
},
ju_BitSet__init_ = ($this, $nbits) => {
    jl_Object__init_($this);
    if ($nbits < 0)
        $rt_throw(jl_NegativeArraySizeException__init_0());
    $this.$data = $rt_createIntArray((($nbits + 32 | 0) - 1 | 0) / 32 | 0);
},
ju_BitSet__init_2 = var_0 => {
    let var_1 = new ju_BitSet();
    ju_BitSet__init_(var_1, var_0);
    return var_1;
},
ju_BitSet_set = ($this, $bitIndex) => {
    let $index, var$3;
    if ($bitIndex < 0)
        $rt_throw(jl_IndexOutOfBoundsException__init_());
    $index = $bitIndex / 32 | 0;
    if ($bitIndex >= $this.$length0) {
        ju_BitSet_ensureCapacity($this, $index + 1 | 0);
        $this.$length0 = $bitIndex + 1 | 0;
    }
    var$3 = $this.$data.data;
    var$3[$index] = var$3[$index] | 1 << ($bitIndex % 32 | 0);
},
ju_BitSet_set0 = ($this, $fromIndex, $toIndex) => {
    let var$3, $fromDataIndex, $toDataIndex, var$6, $i;
    if ($fromIndex >= 0) {
        var$3 = $rt_compare($fromIndex, $toIndex);
        if (var$3 <= 0) {
            if (!var$3)
                return;
            $fromDataIndex = $fromIndex / 32 | 0;
            $toDataIndex = $toIndex / 32 | 0;
            if ($toIndex > $this.$length0) {
                ju_BitSet_ensureCapacity($this, $toDataIndex + 1 | 0);
                $this.$length0 = $toIndex;
            }
            if ($fromDataIndex == $toDataIndex) {
                var$6 = $this.$data.data;
                var$6[$fromDataIndex] = var$6[$fromDataIndex] | ju_BitSet_trailingZeroBits($this, $fromIndex) & ju_BitSet_trailingOneBits($this, $toIndex);
            } else {
                var$6 = $this.$data.data;
                var$6[$fromDataIndex] = var$6[$fromDataIndex] | ju_BitSet_trailingZeroBits($this, $fromIndex);
                $i = $fromDataIndex + 1 | 0;
                while ($i < $toDataIndex) {
                    $this.$data.data[$i] = (-1);
                    $i = $i + 1 | 0;
                }
                if ($toIndex & 31) {
                    var$6 = $this.$data.data;
                    var$6[$toDataIndex] = var$6[$toDataIndex] | ju_BitSet_trailingOneBits($this, $toIndex);
                }
            }
            return;
        }
    }
    $rt_throw(jl_IndexOutOfBoundsException__init_());
},
ju_BitSet_trailingZeroBits = ($this, $num) => {
    let var$2;
    var$2 = $num % 32 | 0;
    return (-1) << var$2;
},
ju_BitSet_trailingOneBits = ($this, $num) => {
    let var$2;
    var$2 = $num % 32 | 0;
    return !var$2 ? 0 : (-1) >>> (32 - var$2 | 0) | 0;
},
ju_BitSet_clear0 = ($this, $bitIndex) => {
    let $index, var$3;
    if ($bitIndex < 0)
        $rt_throw(jl_IndexOutOfBoundsException__init_());
    $index = $bitIndex / 32 | 0;
    if ($index < $this.$data.data.length) {
        var$3 = $this.$data.data;
        var$3[$index] = var$3[$index] & jl_Integer_rotateLeft((-2), $bitIndex % 32 | 0);
        if ($bitIndex == ($this.$length0 - 1 | 0))
            ju_BitSet_recalculateLength($this);
    }
},
ju_BitSet_clear = ($this, $fromIndex, $toIndex) => {
    let var$3, $fromDataIndex, $toDataIndex, var$6, $i;
    if ($fromIndex >= 0 && $fromIndex <= $toIndex) {
        if ($fromIndex >= $this.$length0)
            return;
        var$3 = jl_Math_min($this.$length0, $toIndex);
        if ($fromIndex == var$3)
            return;
        $fromDataIndex = $fromIndex / 32 | 0;
        $toDataIndex = var$3 / 32 | 0;
        if ($fromDataIndex == $toDataIndex) {
            var$6 = $this.$data.data;
            var$6[$fromDataIndex] = var$6[$fromDataIndex] & (ju_BitSet_trailingOneBits($this, $fromIndex) | ju_BitSet_trailingZeroBits($this, var$3));
        } else {
            var$6 = $this.$data.data;
            var$6[$fromDataIndex] = var$6[$fromDataIndex] & ju_BitSet_trailingOneBits($this, $fromIndex);
            $i = $fromDataIndex + 1 | 0;
            while ($i < $toDataIndex) {
                $this.$data.data[$i] = 0;
                $i = $i + 1 | 0;
            }
            if (var$3 & 31) {
                var$6 = $this.$data.data;
                var$6[$toDataIndex] = var$6[$toDataIndex] & ju_BitSet_trailingZeroBits($this, var$3);
            }
        }
        ju_BitSet_recalculateLength($this);
        return;
    }
    $rt_throw(jl_IndexOutOfBoundsException__init_());
},
ju_BitSet_get = ($this, $bitIndex) => {
    let $index;
    if ($bitIndex < 0)
        $rt_throw(jl_IndexOutOfBoundsException__init_());
    $index = $bitIndex / 32 | 0;
    return $index < $this.$data.data.length && $this.$data.data[$index] & 1 << ($bitIndex % 32 | 0) ? 1 : 0;
},
ju_BitSet_nextSetBit = ($this, $fromIndex) => {
    let $index, $val, var$4, $top, $i;
    if ($fromIndex < 0)
        $rt_throw(jl_IndexOutOfBoundsException__init_());
    if ($fromIndex >= $this.$length0)
        return (-1);
    $index = $fromIndex / 32 | 0;
    $val = $this.$data.data[$index];
    var$4 = $val >>> ($fromIndex % 32 | 0) | 0;
    if (var$4)
        return jl_Integer_numberOfTrailingZeros(var$4) + $fromIndex | 0;
    $top = ($this.$length0 + 31 | 0) / 32 | 0;
    $i = $index + 1 | 0;
    while ($i < $top) {
        if ($this.$data.data[$i])
            return ($i * 32 | 0) + jl_Integer_numberOfTrailingZeros($this.$data.data[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return (-1);
},
ju_BitSet_nextClearBit = ($this, $fromIndex) => {
    let $index, $val, var$4, $top, $i;
    if ($fromIndex < 0)
        $rt_throw(jl_IndexOutOfBoundsException__init_());
    if ($fromIndex >= $this.$length0)
        return $fromIndex;
    $index = $fromIndex / 32 | 0;
    $val = $this.$data.data[$index] ^ (-1);
    var$4 = $val >>> ($fromIndex % 32 | 0) | 0;
    if (var$4)
        return jl_Integer_numberOfTrailingZeros(var$4) + $fromIndex | 0;
    $top = ($this.$length0 + 31 | 0) / 32 | 0;
    $i = $index + 1 | 0;
    while ($i < $top) {
        if ($this.$data.data[$i] != (-1))
            return ($i * 32 | 0) + jl_Integer_numberOfTrailingZeros($this.$data.data[$i] ^ (-1)) | 0;
        $i = $i + 1 | 0;
    }
    return $this.$length0;
},
ju_BitSet_ensureCapacity = ($this, $capacity) => {
    let $newArrayLength;
    if ($this.$data.data.length >= $capacity)
        return;
    $newArrayLength = jl_Math_max(($capacity * 3 | 0) / 2 | 0, ($this.$data.data.length * 2 | 0) + 1 | 0);
    $this.$data = ju_Arrays_copyOf2($this.$data, $newArrayLength);
},
ju_BitSet_recalculateLength = $this => {
    let $top, $i, $sz;
    $top = ($this.$length0 + 31 | 0) / 32 | 0;
    $this.$length0 = $top * 32 | 0;
    $i = $top - 1 | 0;
    a: {
        while (true) {
            if ($i < 0)
                break a;
            $sz = jl_Integer_numberOfLeadingZeros($this.$data.data[$i]);
            if ($sz < 32)
                break;
            $i = $i + (-1) | 0;
            $this.$length0 = $this.$length0 - 32 | 0;
        }
        $this.$length0 = $this.$length0 - $sz | 0;
    }
},
ju_BitSet_intersects = ($this, $set) => {
    let $sz, $i;
    $sz = jl_Math_min($this.$data.data.length, $set.$data.data.length);
    $i = 0;
    while ($i < $sz) {
        if ($this.$data.data[$i] & $set.$data.data[$i])
            return 1;
        $i = $i + 1 | 0;
    }
    return 0;
},
ju_BitSet_and = ($this, $set) => {
    let $i, $i_0, var$4;
    $i = jl_Math_min($this.$data.data.length, $set.$data.data.length);
    $i_0 = 0;
    while ($i_0 < $i) {
        var$4 = $this.$data.data;
        var$4[$i_0] = var$4[$i_0] & $set.$data.data[$i_0];
        $i_0 = $i_0 + 1 | 0;
    }
    while ($i < $this.$data.data.length) {
        $this.$data.data[$i] = 0;
        $i = $i + 1 | 0;
    }
    $this.$length0 = jl_Math_min($this.$length0, $set.$length0);
    ju_BitSet_recalculateLength($this);
},
ju_BitSet_andNot = ($this, $set) => {
    let $sz, $i, var$4;
    $sz = jl_Math_min($this.$data.data.length, $set.$data.data.length);
    $i = 0;
    while ($i < $sz) {
        var$4 = $this.$data.data;
        var$4[$i] = var$4[$i] & ($set.$data.data[$i] ^ (-1));
        $i = $i + 1 | 0;
    }
    ju_BitSet_recalculateLength($this);
},
ju_BitSet_or = ($this, $set) => {
    let $sz, $i, var$4;
    $this.$length0 = jl_Math_max($this.$length0, $set.$length0);
    ju_BitSet_ensureCapacity($this, ($this.$length0 + 31 | 0) / 32 | 0);
    $sz = jl_Math_min($this.$data.data.length, $set.$data.data.length);
    $i = 0;
    while ($i < $sz) {
        var$4 = $this.$data.data;
        var$4[$i] = var$4[$i] | $set.$data.data[$i];
        $i = $i + 1 | 0;
    }
},
ju_BitSet_xor = ($this, $set) => {
    let $sz, $i, var$4;
    $this.$length0 = jl_Math_max($this.$length0, $set.$length0);
    ju_BitSet_ensureCapacity($this, ($this.$length0 + 31 | 0) / 32 | 0);
    $sz = jl_Math_min($this.$data.data.length, $set.$data.data.length);
    $i = 0;
    while ($i < $sz) {
        var$4 = $this.$data.data;
        var$4[$i] = var$4[$i] ^ $set.$data.data[$i];
        $i = $i + 1 | 0;
    }
    ju_BitSet_recalculateLength($this);
},
ju_BitSet_isEmpty = $this => {
    return $this.$length0 ? 0 : 1;
};
function jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1() {
    jur_AbstractCharClass.call(this);
    this.$this$019 = null;
}
let jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1__init_ = ($this, $this$0) => {
    $this.$this$019 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1();
    jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1_contains = ($this, $ch) => {
    return jl_Character_isJavaIdentifierStart($ch);
},
jur_NonCapFSet = $rt_classWithoutFields(jur_FSet),
jur_NonCapFSet__init_ = ($this, $groupIndex) => {
    jur_FSet__init_($this, $groupIndex);
},
jur_NonCapFSet__init_0 = var_0 => {
    let var_1 = new jur_NonCapFSet();
    jur_NonCapFSet__init_(var_1, var_0);
    return var_1;
},
jur_NonCapFSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $gr;
    $gr = $this.$getGroupIndex();
    $matchResult.$setConsumed($gr, $stringIndex - $matchResult.$getConsumed($gr) | 0);
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_NonCapFSet_hasConsumed = ($this, $mr) => {
    return 0;
},
ju_NavigableSet = $rt_classWithoutFields(0);
function ju_TreeMap$NavigableKeySet() {
    ju_AbstractSet.call(this);
    this.$map1 = null;
}
let ju_TreeMap$NavigableKeySet__init_ = ($this, $map) => {
    ju_AbstractSet__init_($this);
    $this.$map1 = $map;
},
ju_TreeMap$NavigableKeySet__init_0 = var_0 => {
    let var_1 = new ju_TreeMap$NavigableKeySet();
    ju_TreeMap$NavigableKeySet__init_(var_1, var_0);
    return var_1;
},
ju_TreeMap$NavigableKeySet_first = $this => {
    return $this.$map1.$firstKey();
},
WatchTNoodle = $rt_classWithoutFields(),
WatchTNoodle_puzzle = null,
WatchTNoodle_current = null,
WatchTNoodle_$callClinit = () => {
    WatchTNoodle_$callClinit = $rt_eraseClinit(WatchTNoodle);
    WatchTNoodle__clinit_();
},
WatchTNoodle_generate = ($event, $seedHi, $seedLo) => {
    let var$4, var$5;
    WatchTNoodle_$callClinit();
    if (!$event.$equals(WatchTNoodle_current)) {
        a: {
            var$4 = (-1);
            switch ($event.$hashCode()) {
                case 49650:
                    if (!$event.$equals($rt_s(265)))
                        break a;
                    var$4 = 0;
                    break a;
                case 50643:
                    if (!$event.$equals($rt_s(266)))
                        break a;
                    var$4 = 1;
                    break a;
                case 3456504:
                    if (!$event.$equals($rt_s(267)))
                        break a;
                    var$4 = 2;
                    break a;
                case 109493400:
                    if (!$event.$equals($rt_s(268)))
                        break a;
                    var$4 = 3;
                    break a;
                default:
            }
        }
        b: {
            switch (var$4) {
                case 0:
                    var$5 = owtp_TwoByTwoCubePuzzle__init_0();
                    break b;
                case 1:
                    var$5 = owtp_ThreeByThreeCubePuzzle__init_0();
                    break b;
                case 2:
                    var$5 = owtp_PyraminxPuzzle__init_0();
                    break b;
                case 3:
                    var$5 = owtp_SkewbPuzzle__init_0();
                    break b;
                default:
            }
            $rt_throw(jl_IllegalArgumentException__init_0($event));
        }
        WatchTNoodle_puzzle = var$5;
        WatchTNoodle_current = $event;
    }
    return owts_Puzzle_generateWcaScramble(WatchTNoodle_puzzle, WatchTNoodle$WatchRandom__init_0(Long_or(Long_shl(Long_fromInt($seedHi), 32), jl_Integer_toUnsignedLong($seedLo))));
},
WatchTNoodle_correction = $relativeFacelets => {
    WatchTNoodle_$callClinit();
    return ((cm_Search__init_0()).$solution($relativeFacelets, 21, Long_fromInt(100000), Long_ZERO, 2)).$trim();
},
WatchTNoodle_main = $args => {
    WatchTNoodle_$callClinit();
},
WatchTNoodle_generate$exported$0 = (var$1, var$2, var$3) => {
    WatchTNoodle_$callClinit();
    return $rt_ustr(WatchTNoodle_generate($rt_str(var$1), var$2, var$3));
},
WatchTNoodle_correction$exported$1 = var$1 => {
    WatchTNoodle_$callClinit();
    return $rt_ustr(WatchTNoodle_correction($rt_str(var$1)));
},
WatchTNoodle__clinit_ = () => {
    return;
},
jl_Float = $rt_classWithoutFields(jl_Number),
jl_Float_TYPE = null,
jl_Float_$callClinit = () => {
    jl_Float_$callClinit = $rt_eraseClinit(jl_Float);
    jl_Float__clinit_();
},
jl_Float_hashCode = $f => {
    jl_Float_$callClinit();
    return jl_Float_floatToIntBits($f);
},
jl_Float_compare = ($a, $b) => {
    let $diff, var$4, var$5, var$6;
    jl_Float_$callClinit();
    $diff = (!($a > $b) ? 0 : 1) - (!($b > $a) ? 0 : 1) | 0;
    if (!$diff) {
        var$4 = 1.0 / $a;
        var$5 = 1.0 / $b;
        var$6 = (!(var$4 > var$5) ? 0 : 1) - (!(var$5 > var$4) ? 0 : 1) | 0;
        $diff = (var$6 + ($b !== $b ? 0 : 1) | 0) - ($a !== $a ? 0 : 1) | 0;
    }
    return $diff;
},
jl_Float_floatToIntBits = $value => {
    jl_Float_$callClinit();
    if (isNaN($value) ? 1 : 0)
        return 2143289344;
    return $rt_floatToRawIntBits($value);
},
jl_Float__clinit_ = () => {
    jl_Float_TYPE = $rt_cls($rt_floatcls);
},
ju_Arrays = $rt_classWithoutFields(),
ju_Arrays_copyOf1 = ($array, $length) => {
    let var$3, $result, $sz, $i;
    var$3 = $array.data;
    $result = $rt_createCharArray($length);
    $sz = jl_Math_min($length, var$3.length);
    $i = 0;
    while ($i < $sz) {
        $result.data[$i] = var$3[$i];
        $i = $i + 1 | 0;
    }
    return $result;
},
ju_Arrays_copyOf = ($array, $length) => {
    let var$3, $result, $sz, $i;
    var$3 = $array.data;
    $result = $rt_createByteArray($length);
    $sz = jl_Math_min($length, var$3.length);
    $i = 0;
    while ($i < $sz) {
        $result.data[$i] = var$3[$i];
        $i = $i + 1 | 0;
    }
    return $result;
},
ju_Arrays_copyOf2 = ($array, $length) => {
    let var$3, $result, $sz, $i;
    var$3 = $array.data;
    $result = $rt_createIntArray($length);
    $sz = jl_Math_min($length, var$3.length);
    $i = 0;
    while ($i < $sz) {
        $result.data[$i] = var$3[$i];
        $i = $i + 1 | 0;
    }
    return $result;
},
ju_Arrays_copyOf0 = ($original, $newLength) => {
    let var$3, $result, $sz, $i;
    var$3 = $original.data;
    $result = jlr_Array_newInstance(jl_Class_getComponentType(jl_Object_getClass($original)), $newLength);
    $sz = jl_Math_min($newLength, var$3.length);
    $i = 0;
    while ($i < $sz) {
        $result.data[$i] = var$3[$i];
        $i = $i + 1 | 0;
    }
    return $result;
},
ju_Arrays_fill0 = ($a, $fromIndex, $toIndex, $val) => {
    let var$5, var$6;
    if ($fromIndex > $toIndex)
        $rt_throw(jl_IllegalArgumentException__init_());
    while ($fromIndex < $toIndex) {
        var$5 = $a.data;
        var$6 = $fromIndex + 1 | 0;
        var$5[$fromIndex] = $val;
        $fromIndex = var$6;
    }
},
ju_Arrays_fill = ($a, $val) => {
    ju_Arrays_fill0($a, 0, $a.data.length, $val);
},
ju_Arrays_fill1 = ($a, $fromIndex, $toIndex, $val) => {
    let var$5, var$6;
    if ($fromIndex > $toIndex)
        $rt_throw(jl_IllegalArgumentException__init_());
    while ($fromIndex < $toIndex) {
        var$5 = $a.data;
        var$6 = $fromIndex + 1 | 0;
        var$5[$fromIndex] = $val;
        $fromIndex = var$6;
    }
},
ju_Arrays_fill2 = ($a, $fromIndex, $toIndex, $val) => {
    let var$5, var$6;
    if ($fromIndex > $toIndex)
        $rt_throw(jl_IllegalArgumentException__init_());
    while ($fromIndex < $toIndex) {
        var$5 = $a.data;
        var$6 = $fromIndex + 1 | 0;
        var$5[$fromIndex] = $val;
        $fromIndex = var$6;
    }
},
ju_Arrays_mismatchImpl4 = ($a, $aStart, $a2, $a2Start, $length) => {
    let $i, var$7;
    $i = 0;
    while (true) {
        if ($i >= $length)
            return (-1);
        var$7 = $a2.data;
        if ($a.data[$i + $aStart | 0] != var$7[$i + $a2Start | 0])
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
ju_Arrays_equals0 = ($a, $a2) => {
    let var$3, var$4;
    if ($a === $a2)
        return 1;
    if ($a !== null && $a2 !== null) {
        var$3 = $a2.data;
        var$4 = $a.data.length;
        if (var$4 == var$3.length)
            return ju_Arrays_mismatchImpl4($a, 0, $a2, 0, var$4) >= 0 ? 0 : 1;
    }
    return 0;
},
ju_Arrays_mismatchImpl2 = ($a, $aStart, $a2, $a2Start, $length) => {
    let $i, var$7;
    $i = 0;
    while (true) {
        if ($i >= $length)
            return (-1);
        var$7 = $a2.data;
        if ($a.data[$i + $aStart | 0] != var$7[$i + $a2Start | 0])
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
ju_Arrays_equals3 = ($a, $a2) => {
    let var$3, var$4;
    if ($a === $a2)
        return 1;
    if ($a !== null && $a2 !== null) {
        var$3 = $a2.data;
        var$4 = $a.data.length;
        if (var$4 == var$3.length)
            return ju_Arrays_mismatchImpl2($a, 0, $a2, 0, var$4) >= 0 ? 0 : 1;
    }
    return 0;
},
ju_Arrays_mismatchImpl = ($a, $aStart, $a2, $a2Start, $length) => {
    let $i, var$7;
    $i = 0;
    while (true) {
        if ($i >= $length)
            return (-1);
        var$7 = $a2.data;
        if ($a.data[$i + $aStart | 0] != var$7[$i + $a2Start | 0])
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
ju_Arrays_equals5 = ($a, $a2) => {
    let var$3, var$4;
    if ($a === $a2)
        return 1;
    if ($a !== null && $a2 !== null) {
        var$3 = $a2.data;
        var$4 = $a.data.length;
        if (var$4 == var$3.length)
            return ju_Arrays_mismatchImpl($a, 0, $a2, 0, var$4) >= 0 ? 0 : 1;
    }
    return 0;
},
ju_Arrays_mismatchImpl0 = ($a, $aStart, $a2, $a2Start, $length) => {
    let $i, var$7;
    $i = 0;
    while (true) {
        if ($i >= $length)
            return (-1);
        var$7 = $a2.data;
        if ($a.data[$i + $aStart | 0] != var$7[$i + $a2Start | 0])
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
ju_Arrays_equals = ($a, $a2) => {
    let var$3, var$4;
    if ($a === $a2)
        return 1;
    if ($a !== null && $a2 !== null) {
        var$3 = $a2.data;
        var$4 = $a.data.length;
        if (var$4 == var$3.length)
            return ju_Arrays_mismatchImpl0($a, 0, $a2, 0, var$4) >= 0 ? 0 : 1;
    }
    return 0;
},
ju_Arrays_mismatchImpl1 = ($a, $aStart, $a2, $a2Start, $length) => {
    let $i;
    $i = 0;
    while (true) {
        if ($i >= $length)
            return (-1);
        if (jl_Float_compare($a.data[$i + $aStart | 0], $a2.data[$i + $a2Start | 0]))
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
ju_Arrays_equals1 = ($a, $a2) => {
    let var$3, var$4;
    if ($a === $a2)
        return 1;
    if ($a !== null && $a2 !== null) {
        var$3 = $a2.data;
        var$4 = $a.data.length;
        if (var$4 == var$3.length)
            return ju_Arrays_mismatchImpl1($a, 0, $a2, 0, var$4) >= 0 ? 0 : 1;
    }
    return 0;
},
ju_Arrays_mismatchImpl5 = ($a, $aStart, $a2, $a2Start, $length) => {
    let $i;
    $i = 0;
    while (true) {
        if ($i >= $length)
            return (-1);
        if (jl_Double_compare($a.data[$i + $aStart | 0], $a2.data[$i + $a2Start | 0]))
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
ju_Arrays_equals4 = ($a, $a2) => {
    let var$3, var$4;
    if ($a === $a2)
        return 1;
    if ($a !== null && $a2 !== null) {
        var$3 = $a2.data;
        var$4 = $a.data.length;
        if (var$4 == var$3.length)
            return ju_Arrays_mismatchImpl5($a, 0, $a2, 0, var$4) >= 0 ? 0 : 1;
    }
    return 0;
},
ju_Arrays_mismatchImpl3 = ($a, $a2, $length) => {
    let $i, var$5;
    $i = 0;
    while (true) {
        if ($i >= $length)
            return (-1);
        var$5 = $a2.data;
        if ($a.data[$i] != var$5[$i])
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
ju_Arrays_equals2 = ($a, $a2) => {
    let var$3, var$4;
    if ($a === $a2)
        return 1;
    if ($a !== null && $a2 !== null) {
        var$3 = $a2.data;
        var$4 = $a.data.length;
        if (var$4 == var$3.length)
            return ju_Arrays_mismatchImpl3($a, $a2, var$4) >= 0 ? 0 : 1;
    }
    return 0;
},
ju_Arrays_hashCode3 = $a => {
    let $hash, $i, var$4;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        $hash = (31 * $hash | 0) + jl_Boolean_hashCode(var$4[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
},
ju_Arrays_hashCode2 = $a => {
    let $hash, $i, var$4;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        $hash = (31 * $hash | 0) + jl_Long_hashCode(var$4[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
},
ju_Arrays_hashCode4 = $a => {
    let $hash, $i, var$4;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        $hash = (31 * $hash | 0) + jl_Integer_hashCode(var$4[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
},
ju_Arrays_hashCode0 = $a => {
    let $hash, $i, var$4;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        $hash = (31 * $hash | 0) + jl_Byte_hashCode(var$4[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
},
ju_Arrays_hashCode = $a => {
    let $hash, $i, var$4;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        $hash = (31 * $hash | 0) + jl_Short_hashCode(var$4[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
},
ju_Arrays_hashCode6 = $a => {
    let $hash, $i, var$4;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        $hash = (31 * $hash | 0) + jl_Character_hashCode(var$4[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
},
ju_Arrays_hashCode1 = $a => {
    let $hash, $i, var$4;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        $hash = (31 * $hash | 0) + jl_Float_hashCode(var$4[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
};
let ju_Arrays_hashCode5 = $a => {
    let $hash, $i, var$4;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        $hash = (31 * $hash | 0) + jl_Double_hashCode(var$4[$i]) | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
},
ju_Arrays_deepHashCode = $a => {
    let $hash, $i, var$4, $el, $h;
    if ($a === null)
        return 0;
    $hash = 1;
    $i = 0;
    while (true) {
        var$4 = $a.data;
        if ($i >= var$4.length)
            break;
        a: {
            $el = var$4[$i];
            if ($rt_isInstance(var$4[$i], $rt_arraycls($rt_booleancls))) {
                $h = ju_Arrays_hashCode3($el);
                break a;
            }
            if ($rt_isInstance(var$4[$i], $rt_arraycls($rt_bytecls))) {
                $h = ju_Arrays_hashCode0($el);
                break a;
            }
            if ($rt_isInstance(var$4[$i], $rt_arraycls($rt_shortcls))) {
                $h = ju_Arrays_hashCode($el);
                break a;
            }
            if ($rt_isInstance(var$4[$i], $rt_arraycls($rt_charcls))) {
                $h = ju_Arrays_hashCode6($el);
                break a;
            }
            if ($rt_isInstance(var$4[$i], $rt_arraycls($rt_intcls))) {
                $h = ju_Arrays_hashCode4($el);
                break a;
            }
            if ($rt_isInstance(var$4[$i], $rt_arraycls($rt_longcls))) {
                $h = ju_Arrays_hashCode2($el);
                break a;
            }
            if ($rt_isInstance(var$4[$i], $rt_arraycls($rt_floatcls))) {
                $h = ju_Arrays_hashCode1($el);
                break a;
            }
            if ($rt_isInstance(var$4[$i], $rt_arraycls($rt_doublecls))) {
                $h = ju_Arrays_hashCode5($el);
                break a;
            }
            if (!$rt_isInstance(var$4[$i], $rt_arraycls(jl_Object))) {
                $h = ju_Objects_hashCode($el);
                break a;
            }
            $h = ju_Arrays_deepHashCode($el);
        }
        $hash = (31 * $hash | 0) + $h | 0;
        $i = $i + 1 | 0;
    }
    return $hash;
},
ju_Arrays_deepEquals = ($a1, $a2) => {
    let var$3, var$4, var$5, $i, $e1, $e2;
    if ($a1 === $a2)
        return 1;
    if ($a1 !== null && $a2 !== null) {
        var$3 = $a2.data;
        var$4 = $a1.data;
        var$5 = var$4.length;
        if (var$5 == var$3.length) {
            $i = 0;
            while ($i < var$5) {
                $e1 = var$4[$i];
                $e2 = var$3[$i];
                if (!ju_Objects_deepEquals($e1, $e2))
                    return 0;
                $i = $i + 1 | 0;
            }
            return 1;
        }
    }
    return 0;
};
function jur_CharSet() {
    jur_LeafSet.call(this);
    this.$ch0 = 0;
}
let jur_CharSet__init_0 = ($this, $ch) => {
    jur_LeafSet__init_($this);
    $this.$ch0 = $ch;
},
jur_CharSet__init_ = var_0 => {
    let var_1 = new jur_CharSet();
    jur_CharSet__init_0(var_1, var_0);
    return var_1;
},
jur_CharSet_charCount = $this => {
    return 1;
},
jur_CharSet_accepts = ($this, $strIndex, $testString) => {
    return $this.$ch0 != $testString.$charAt($strIndex) ? (-1) : 1;
},
jur_CharSet_find = ($this, $strIndex, $testString, $matchResult) => {
    let $testStr, $strLength, var$6, var$7;
    if (!($testString instanceof jl_String))
        return jur_AbstractSet_find($this, $strIndex, $testString, $matchResult);
    $testStr = $testString;
    $strLength = $matchResult.$getRightBound();
    while (true) {
        if ($strIndex >= $strLength)
            return (-1);
        var$6 = $testStr.$indexOf2($this.$ch0, $strIndex);
        if (var$6 < 0)
            return (-1);
        var$7 = $this.$next3;
        $strIndex = var$6 + 1 | 0;
        if (var$7.$matches($strIndex, $testString, $matchResult) >= 0)
            break;
    }
    return var$6;
},
jur_CharSet_findBack = ($this, $strIndex, $lastIndex, $testString, $matchResult) => {
    let $testStr, var$6;
    if (!($testString instanceof jl_String))
        return jur_AbstractSet_findBack($this, $strIndex, $lastIndex, $testString, $matchResult);
    $testStr = $testString;
    a: {
        while (true) {
            if ($lastIndex < $strIndex)
                return (-1);
            var$6 = $testStr.$lastIndexOf1($this.$ch0, $lastIndex);
            if (var$6 < 0)
                break a;
            if (var$6 < $strIndex)
                break a;
            if ($this.$next3.$matches(var$6 + 1 | 0, $testString, $matchResult) >= 0)
                break;
            $lastIndex = var$6 + (-1) | 0;
        }
        return var$6;
    }
    return (-1);
},
jur_CharSet_getChar = $this => {
    return $this.$ch0;
},
jur_CharSet_first = ($this, $set) => {
    if ($set instanceof jur_CharSet)
        return $set.$getChar() != $this.$ch0 ? 0 : 1;
    if (!($set instanceof jur_RangeSet)) {
        if ($set instanceof jur_SupplRangeSet)
            return $set.$contains0($this.$ch0);
        if (!($set instanceof jur_SupplCharSet))
            return 1;
        return 0;
    }
    return $set.$accepts(0, jl_Character_toString($this.$ch0)) <= 0 ? 0 : 1;
};
function jur_UCISupplCharSet() {
    jur_LeafSet.call(this);
    this.$ch4 = 0;
}
let jur_UCISupplCharSet__init_ = ($this, $ch) => {
    jur_LeafSet__init_($this);
    $this.$charCount0 = 2;
    $this.$ch4 = jl_Character_toLowerCase0(jl_Character_toUpperCase0($ch));
},
jur_UCISupplCharSet__init_0 = var_0 => {
    let var_1 = new jur_UCISupplCharSet();
    jur_UCISupplCharSet__init_(var_1, var_0);
    return var_1;
},
jur_UCISupplCharSet_accepts = ($this, $strIndex, $testString) => {
    let var$3, $high, $low;
    var$3 = $strIndex + 1 | 0;
    $high = $testString.$charAt($strIndex);
    $low = $testString.$charAt(var$3);
    return $this.$ch4 != jl_Character_toLowerCase0(jl_Character_toUpperCase0(jl_Character_toCodePoint($high, $low))) ? (-1) : 2;
},
jl_System = $rt_classWithoutFields(),
jl_System_arraycopy = ($src, $srcPos, $dest, $destPos, $length) => {
    let var$6, $srcType, $targetType, $srcArray, $i, var$11, var$12, $elem;
    if ($src !== null && $dest !== null) {
        if ($srcPos >= 0 && $destPos >= 0 && $length >= 0 && ($srcPos + $length | 0) <= jlr_Array_getLength($src)) {
            var$6 = $destPos + $length | 0;
            if (var$6 <= jlr_Array_getLength($dest)) {
                a: {
                    b: {
                        if ($src !== $dest) {
                            $srcType = jl_Class_getComponentType(jl_Object_getClass($src));
                            $targetType = jl_Class_getComponentType(jl_Object_getClass($dest));
                            if ($srcType !== null && $targetType !== null) {
                                if ($srcType === $targetType)
                                    break b;
                                if (!jl_Class_isPrimitive($srcType) && !jl_Class_isPrimitive($targetType)) {
                                    $srcArray = $src;
                                    $i = 0;
                                    var$6 = $srcPos;
                                    while ($i < $length) {
                                        var$11 = $srcArray.data;
                                        var$12 = var$6 + 1 | 0;
                                        $elem = var$11[var$6];
                                        if (!jl_Class_isInstance($targetType, $elem)) {
                                            jl_System_doArrayCopy($src, $srcPos, $dest, $destPos, $i);
                                            $rt_throw(jl_ArrayStoreException__init_());
                                        }
                                        $i = $i + 1 | 0;
                                        var$6 = var$12;
                                    }
                                    jl_System_doArrayCopy($src, $srcPos, $dest, $destPos, $length);
                                    return;
                                }
                                if (!jl_Class_isPrimitive($srcType))
                                    break a;
                                if (jl_Class_isPrimitive($targetType))
                                    break b;
                                else
                                    break a;
                            }
                            $rt_throw(jl_ArrayStoreException__init_());
                        }
                    }
                    jl_System_doArrayCopy($src, $srcPos, $dest, $destPos, $length);
                    return;
                }
                $rt_throw(jl_ArrayStoreException__init_());
            }
        }
        $rt_throw(jl_IndexOutOfBoundsException__init_());
    }
    $rt_throw(jl_NullPointerException__init_($rt_s(269)));
},
jl_System_fastArraycopy = ($src, $srcPos, $dest, $destPos, $length) => {
    let var$6;
    if ($srcPos >= 0 && $destPos >= 0 && $length >= 0 && ($srcPos + $length | 0) <= jlr_Array_getLength($src)) {
        var$6 = $destPos + $length | 0;
        if (var$6 <= jlr_Array_getLength($dest)) {
            jl_System_doArrayCopy($src, $srcPos, $dest, $destPos, $length);
            return;
        }
    }
    $rt_throw(jl_IndexOutOfBoundsException__init_());
},
jl_System_doArrayCopy = (var$1, var$2, var$3, var$4, var$5) => {
    if (var$5 !== 0) {
        if (typeof var$1.data.buffer !== 'undefined') {
            var$3.data.set(var$1.data.subarray(var$2, var$2 + var$5), var$4);
        } else if (var$1 !== var$3 || var$4 < var$2) {
            for (let i = 0;i < var$5;i = i + 1 | 0) {
                var$3.data[var$4++] = var$1.data[var$2++];
            }
        } else {
            var$2 = var$2 + var$5 | 0;
            var$4 = var$4 + var$5 | 0;
            for (let i = 0;i < var$5;i = i + 1 | 0) {
                var$3.data[ --var$4] = var$1.data[ --var$2];
            }
        }
    }
},
jl_System_currentTimeMillis = () => {
    return Long_fromNumber((new Date()).getTime());
},
jl_System_getenv = var$1 => {
    return null;
};
function jur_CharClass$3() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$curAlt = 0;
    a.$val$cc = null;
    a.$this$03 = null;
}
let jur_CharClass$3__init_ = ($this, $this$0, var$2, var$3) => {
    $this.$this$03 = $this$0;
    $this.$val$curAlt = var$2;
    $this.$val$cc = var$3;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$3__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_CharClass$3();
    jur_CharClass$3__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_CharClass$3_contains = ($this, $ch) => {
    return !($this.$val$curAlt ^ $this.$this$03.$bits.$get1($ch)) && !($this.$val$curAlt ^ $this.$this$03.$inverted ^ $this.$val$cc.$contains0($ch)) ? 0 : 1;
};
function jur_CharClass$4() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$curAlt9 = 0;
    a.$val$nb4 = null;
    a.$val$cc2 = null;
    a.$this$037 = null;
}
let jur_CharClass$4__init_ = ($this, $this$0, var$2, var$3, var$4) => {
    $this.$this$037 = $this$0;
    $this.$val$curAlt9 = var$2;
    $this.$val$nb4 = var$3;
    $this.$val$cc2 = var$4;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$4__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_CharClass$4();
    jur_CharClass$4__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_CharClass$4_contains = ($this, $ch) => {
    return $this.$val$curAlt9 ^ (!$this.$val$nb4.$contains0($ch) && !$this.$val$cc2.$contains0($ch) ? 0 : 1) ? 0 : 1;
};
function jur_CharClass$1() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$cc3 = null;
    a.$this$013 = null;
}
let jur_CharClass$1__init_ = ($this, $this$0, var$2) => {
    $this.$this$013 = $this$0;
    $this.$val$cc3 = var$2;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$1__init_0 = (var_0, var_1) => {
    let var_2 = new jur_CharClass$1();
    jur_CharClass$1__init_(var_2, var_0, var_1);
    return var_2;
},
jur_CharClass$1_contains = ($this, $ch) => {
    return $this.$val$cc3.$contains0($ch);
};
function jur_CharClass$2() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$curAlt0 = 0;
    a.$val$cc1 = null;
    a.$this$02 = null;
}
let jur_CharClass$2__init_ = ($this, $this$0, var$2, var$3) => {
    $this.$this$02 = $this$0;
    $this.$val$curAlt0 = var$2;
    $this.$val$cc1 = var$3;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$2__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_CharClass$2();
    jur_CharClass$2__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_CharClass$2_contains = ($this, $ch) => {
    return !($this.$val$curAlt0 ^ $this.$this$02.$bits.$get1($ch)) && !($this.$val$curAlt0 ^ $this.$this$02.$inverted ^ $this.$val$cc1.$contains0($ch)) ? 1 : 0;
};
function jur_AbstractCharClass$LazyRange() {
    let a = this; jur_AbstractCharClass$LazyCharClass.call(a);
    a.$start4 = 0;
    a.$end2 = 0;
}
let jur_AbstractCharClass$LazyRange__init_0 = ($this, $start, $end) => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
    $this.$start4 = $start;
    $this.$end2 = $end;
},
jur_AbstractCharClass$LazyRange__init_ = (var_0, var_1) => {
    let var_2 = new jur_AbstractCharClass$LazyRange();
    jur_AbstractCharClass$LazyRange__init_0(var_2, var_0, var_1);
    return var_2;
},
jur_AbstractCharClass$LazyRange_computeValue = $this => {
    let $chCl;
    $chCl = (jur_CharClass__init_()).$add1($this.$start4, $this.$end2);
    return $chCl;
};
function jur_CharClass$7() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$clazz7 = null;
    a.$this$038 = null;
}
let jur_CharClass$7__init_ = ($this, $this$0, var$2) => {
    $this.$this$038 = $this$0;
    $this.$val$clazz7 = var$2;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$7__init_0 = (var_0, var_1) => {
    let var_2 = new jur_CharClass$7();
    jur_CharClass$7__init_(var_2, var_0, var_1);
    return var_2;
},
jur_CharClass$7_contains = ($this, $ch) => {
    return $this.$val$clazz7.$contains0($ch);
},
jur_AbstractCharClass$LazyXDigit = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyXDigit__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyXDigit__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyXDigit();
    jur_AbstractCharClass$LazyXDigit__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyXDigit_computeValue = $this => {
    return (((jur_CharClass__init_()).$add1(48, 57)).$add1(97, 102)).$add1(65, 70);
};
function jur_CharClass$8() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$clazz1 = null;
    a.$val$curAlt2 = 0;
    a.$this$05 = null;
}
let jur_CharClass$8__init_ = ($this, $this$0, var$2, var$3) => {
    $this.$this$05 = $this$0;
    $this.$val$clazz1 = var$2;
    $this.$val$curAlt2 = var$3;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$8__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_CharClass$8();
    jur_CharClass$8__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_CharClass$8_contains = ($this, $ch) => {
    return !$this.$val$clazz1.$contains0($ch) && !($this.$val$curAlt2 ^ $this.$this$05.$bits.$get1($ch)) ? 1 : 0;
};
function jur_CharClass$5() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$curAlt7 = 0;
    a.$val$nb3 = null;
    a.$val$cc0 = null;
    a.$this$023 = null;
}
let jur_CharClass$5__init_ = ($this, $this$0, var$2, var$3, var$4) => {
    $this.$this$023 = $this$0;
    $this.$val$curAlt7 = var$2;
    $this.$val$nb3 = var$3;
    $this.$val$cc0 = var$4;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$5__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_CharClass$5();
    jur_CharClass$5__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_CharClass$5_contains = ($this, $ch) => {
    return $this.$val$curAlt7 ^ (!$this.$val$nb3.$contains0($ch) && !$this.$val$cc0.$contains0($ch) ? 0 : 1);
};
function jur_CharClass$6() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$clazz6 = null;
    a.$this$025 = null;
}
let jur_CharClass$6__init_ = ($this, $this$0, var$2) => {
    $this.$this$025 = $this$0;
    $this.$val$clazz6 = var$2;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$6__init_0 = (var_0, var_1) => {
    let var_2 = new jur_CharClass$6();
    jur_CharClass$6__init_(var_2, var_0, var_1);
    return var_2;
},
jur_CharClass$6_contains = ($this, $ch) => {
    return $this.$val$clazz6.$contains0($ch) ? 0 : 1;
},
ju_Collections$5 = $rt_classWithoutFields(),
ju_Collections$5__init_ = $this => {
    jl_Object__init_($this);
},
ju_Collections$5__init_0 = () => {
    let var_0 = new ju_Collections$5();
    ju_Collections$5__init_(var_0);
    return var_0;
};
function ju_LinkedList$Entry() {
    let a = this; jl_Object.call(a);
    a.$item = null;
    a.$next6 = null;
    a.$previous = null;
}
let ju_LinkedList$Entry__init_ = $this => {
    jl_Object__init_($this);
},
ju_LinkedList$Entry__init_0 = () => {
    let var_0 = new ju_LinkedList$Entry();
    ju_LinkedList$Entry__init_(var_0);
    return var_0;
};
function jl_Enum() {
    let a = this; jl_Object.call(a);
    a.$name0 = null;
    a.$ordinal0 = 0;
}
let jl_Enum__init_ = ($this, $name, $ordinal) => {
    jl_Object__init_($this);
    $this.$name0 = $name;
    $this.$ordinal0 = $ordinal;
},
jl_Enum_name = $this => {
    return $this.$name0;
},
jl_Enum_ordinal = $this => {
    return $this.$ordinal0;
},
jl_Enum_toString = $this => {
    return $this.$name0.$toString();
},
jl_Enum_equals = ($this, $other) => {
    return $this !== $other ? 0 : 1;
},
jl_Enum_hashCode = $this => {
    return jl_Object_hashCode($this);
},
jl_Enum_valueOf = ($enumType, $name) => {
    let $constants, var$4, var$5, var$6, var$7, var$8, var$9, var$10, $constant;
    $constants = jl_Class_getEnumConstants($enumType);
    if ($constants === null)
        $rt_throw(jl_IllegalArgumentException__init_0($rt_s(270)));
    var$4 = $constants.data;
    var$5 = var$4.length;
    var$6 = 0;
    while (true) {
        if (var$6 >= var$5) {
            var$7 = new jl_IllegalArgumentException;
            var$8 = jl_String_valueOf($enumType);
            var$9 = jl_String_valueOf($name);
            var$10 = jl_StringBuilder__init_();
            jl_StringBuilder_append(jl_StringBuilder_append(jl_StringBuilder_append(jl_StringBuilder_append(jl_StringBuilder_append(var$10, $rt_s(271)), var$8), $rt_s(272)), var$9), $rt_s(273));
            jl_IllegalArgumentException__init_2(var$7, jl_StringBuilder_toString(var$10));
            $rt_throw(var$7);
        }
        $constant = var$4[var$6];
        if ((jl_Enum_name($constant)).$equals($name))
            break;
        var$6 = var$6 + 1 | 0;
    }
    return $constant;
},
owts_AlgorithmBuilder$MergingMode = $rt_classWithoutFields(jl_Enum),
owts_AlgorithmBuilder$MergingMode_NO_MERGING = null,
owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES = null,
owts_AlgorithmBuilder$MergingMode_$VALUES = null,
owts_AlgorithmBuilder$MergingMode_$callClinit = () => {
    owts_AlgorithmBuilder$MergingMode_$callClinit = $rt_eraseClinit(owts_AlgorithmBuilder$MergingMode);
    owts_AlgorithmBuilder$MergingMode__clinit_();
},
owts_AlgorithmBuilder$MergingMode__init_0 = ($this, var$1, var$2) => {
    owts_AlgorithmBuilder$MergingMode_$callClinit();
    jl_Enum__init_($this, var$1, var$2);
},
owts_AlgorithmBuilder$MergingMode__init_ = (var_0, var_1) => {
    let var_2 = new owts_AlgorithmBuilder$MergingMode();
    owts_AlgorithmBuilder$MergingMode__init_0(var_2, var_0, var_1);
    return var_2;
},
owts_AlgorithmBuilder$MergingMode__clinit_ = () => {
    let var$1, var$2;
    owts_AlgorithmBuilder$MergingMode_NO_MERGING = owts_AlgorithmBuilder$MergingMode__init_($rt_s(274), 0);
    owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES = owts_AlgorithmBuilder$MergingMode__init_($rt_s(275), 1);
    var$1 = $rt_createArray(owts_AlgorithmBuilder$MergingMode, 2);
    var$2 = var$1.data;
    var$2[0] = owts_AlgorithmBuilder$MergingMode_NO_MERGING;
    var$2[1] = owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES;
    owts_AlgorithmBuilder$MergingMode_$VALUES = var$1;
};
function jur_DotSet() {
    jur_JointSet.call(this);
    this.$lt0 = null;
}
let jur_DotSet__init_ = ($this, $lt) => {
    jur_JointSet__init_($this);
    $this.$lt0 = $lt;
},
jur_DotSet__init_0 = var_0 => {
    let var_1 = new jur_DotSet();
    jur_DotSet__init_(var_1, var_0);
    return var_1;
},
jur_DotSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength, var$5, $high, var$7, $low;
    $strLength = $matchResult.$getRightBound();
    var$5 = $stringIndex + 1 | 0;
    if (var$5 > $strLength) {
        $matchResult.$hitEnd = 1;
        return (-1);
    }
    $high = $testString.$charAt($stringIndex);
    if (jl_Character_isHighSurrogate($high)) {
        var$7 = $stringIndex + 2 | 0;
        if (var$7 <= $strLength) {
            $low = $testString.$charAt(var$5);
            if (jl_Character_isSurrogatePair($high, $low))
                return $this.$lt0.$isLineTerminator(jl_Character_toCodePoint($high, $low)) ? (-1) : $this.$next3.$matches(var$7, $testString, $matchResult);
        }
    }
    return $this.$lt0.$isLineTerminator($high) ? (-1) : $this.$next3.$matches(var$5, $testString, $matchResult);
},
jur_DotSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_DotSet_getType = $this => {
    return (-2147483602);
},
jur_DotSet_hasConsumed = ($this, $matchResult) => {
    return 1;
},
ju_RandomAccess = $rt_classWithoutFields(0),
ju_TemplateCollections$AbstractImmutableList = $rt_classWithoutFields(ju_AbstractList),
ju_TemplateCollections$AbstractImmutableList__init_ = $this => {
    ju_AbstractList__init_($this);
},
ju_Collections$3 = $rt_classWithoutFields(ju_TemplateCollections$AbstractImmutableList),
ju_Collections$3__init_ = $this => {
    ju_TemplateCollections$AbstractImmutableList__init_($this);
},
ju_Collections$3__init_0 = () => {
    let var_0 = new ju_Collections$3();
    ju_Collections$3__init_(var_0);
    return var_0;
};
function jur_CharClass$9() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$val$clazz = null;
    a.$val$curAlt8 = 0;
    a.$this$09 = null;
}
let jur_CharClass$9__init_ = ($this, $this$0, var$2, var$3) => {
    $this.$this$09 = $this$0;
    $this.$val$clazz = var$2;
    $this.$val$curAlt8 = var$3;
    jur_AbstractCharClass__init_($this);
},
jur_CharClass$9__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_CharClass$9();
    jur_CharClass$9__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_CharClass$9_contains = ($this, $ch) => {
    return !$this.$val$clazz.$contains0($ch) && !($this.$val$curAlt8 ^ $this.$this$09.$bits.$get1($ch)) ? 0 : 1;
};
function jur_Matcher() {
    let a = this; jl_Object.call(a);
    a.$pat = null;
    a.$start3 = null;
    a.$string0 = null;
    a.$matchResult = null;
    a.$leftBound = 0;
    a.$rightBound = 0;
}
let jur_Matcher_find = ($this, $start) => {
    let $stringLength, var$3;
    $stringLength = $this.$string0.$length();
    if ($start >= 0 && $start <= $stringLength) {
        var$3 = jur_Matcher_findAt($this, $start);
        if (var$3 >= 0 && $this.$matchResult.$isValid()) {
            $this.$matchResult.$finalizeMatch();
            return 1;
        }
        $this.$matchResult.$startIndex = (-1);
        return 0;
    }
    $rt_throw(jl_IndexOutOfBoundsException__init_1(jl_String_valueOf0($start)));
},
jur_Matcher_findAt = ($this, $startIndex) => {
    let $foundIndex;
    $this.$matchResult.$reset0();
    $this.$matchResult.$setMode(1);
    $this.$matchResult.$setStartIndex($startIndex);
    $foundIndex = $this.$start3.$find($startIndex, $this.$string0, $this.$matchResult);
    if ($foundIndex == (-1))
        $this.$matchResult.$hitEnd = 1;
    return $foundIndex;
},
jur_Matcher_find0 = $this => {
    let $length, var$2;
    $length = $this.$string0.$length();
    if (!jur_Matcher_hasTransparentBounds($this))
        $length = $this.$rightBound;
    if ($this.$matchResult.$startIndex >= 0 && $this.$matchResult.$mode() == 1) {
        $this.$matchResult.$startIndex = $this.$matchResult.$end0();
        if ($this.$matchResult.$end0() == $this.$matchResult.$start0()) {
            var$2 = $this.$matchResult;
            var$2.$startIndex = var$2.$startIndex + 1 | 0;
        }
        return $this.$matchResult.$startIndex <= $length && jur_Matcher_find($this, $this.$matchResult.$startIndex) ? 1 : 0;
    }
    return jur_Matcher_find($this, $this.$leftBound);
},
jur_Matcher_start0 = ($this, $group) => {
    return $this.$matchResult.$start($group);
},
jur_Matcher_end = ($this, $group) => {
    return $this.$matchResult.$end($group);
},
jur_Matcher_start = $this => {
    return jur_Matcher_start0($this, 0);
},
jur_Matcher_end0 = $this => {
    return jur_Matcher_end($this, 0);
},
jur_Matcher_hasTransparentBounds = $this => {
    return $this.$matchResult.$hasTransparentBounds();
},
jur_Matcher__init_ = ($this, $pat, $cs) => {
    let var$3, var$4, var$5, var$6, var$7;
    jl_Object__init_($this);
    $this.$leftBound = (-1);
    $this.$rightBound = (-1);
    $this.$pat = $pat;
    $this.$start3 = $pat.$start1;
    $this.$string0 = $cs;
    $this.$leftBound = 0;
    $this.$rightBound = $this.$string0.$length();
    var$3 = new jur_MatchResultImpl;
    var$4 = $this.$leftBound;
    var$5 = $this.$rightBound;
    var$6 = jur_Pattern_groupCount($pat);
    var$7 = jur_Pattern_compCount($pat);
    jur_MatchResultImpl__init_(var$3, $cs, var$4, var$5, var$6, var$7, jur_Pattern_consCount($pat), jur_Pattern_namedGroups($pat));
    $this.$matchResult = var$3;
    $this.$matchResult.$useAnchoringBounds(1);
},
jur_Matcher__init_0 = (var_0, var_1) => {
    let var_2 = new jur_Matcher();
    jur_Matcher__init_(var_2, var_0, var_1);
    return var_2;
},
ju_Collections$4 = $rt_classWithoutFields(),
ju_Collections$4__init_ = $this => {
    jl_Object__init_($this);
},
ju_Collections$4__init_0 = () => {
    let var_0 = new ju_Collections$4();
    ju_Collections$4__init_(var_0);
    return var_0;
},
jl_Character = $rt_classWithoutFields(),
jl_Character_TYPE = null,
jl_Character_digitMapping = null,
jl_Character_upperCaseMapping = null,
jl_Character_lowerCaseMapping = null,
jl_Character_classMapping = null,
jl_Character_characterCache = null,
jl_Character_$$metadata$$0 = null,
jl_Character_$$metadata$$1 = null,
jl_Character_$$metadata$$3 = null,
jl_Character_$$metadata$$4 = null,
jl_Character_$callClinit = () => {
    jl_Character_$callClinit = $rt_eraseClinit(jl_Character);
    jl_Character__clinit_();
},
jl_Character_hashCode = $value => {
    jl_Character_$callClinit();
    return $value;
},
jl_Character_toString = $c => {
    let var$2, var$3;
    jl_Character_$callClinit();
    var$2 = new jl_String;
    var$3 = $rt_createCharArray(1);
    var$3.data[0] = $c;
    jl_String__init_(var$2, var$3);
    return var$2;
},
jl_Character_isValidCodePoint = $codePoint => {
    jl_Character_$callClinit();
    return $codePoint >= 0 && $codePoint <= 1114111 ? 1 : 0;
},
jl_Character_isBmpCodePoint = $codePoint => {
    jl_Character_$callClinit();
    return $codePoint > 0 && $codePoint <= 65535 ? 1 : 0;
},
jl_Character_isSupplementaryCodePoint = $codePoint => {
    jl_Character_$callClinit();
    return $codePoint >= 65536 && $codePoint <= 1114111 ? 1 : 0;
},
jl_Character_isHighSurrogate = $ch => {
    jl_Character_$callClinit();
    return ($ch & 64512) != 55296 ? 0 : 1;
},
jl_Character_isLowSurrogate = $ch => {
    jl_Character_$callClinit();
    return ($ch & 64512) != 56320 ? 0 : 1;
},
jl_Character_isSurrogate = $ch => {
    jl_Character_$callClinit();
    return !jl_Character_isHighSurrogate($ch) && !jl_Character_isLowSurrogate($ch) ? 0 : 1;
},
jl_Character_isSurrogatePair = ($high, $low) => {
    jl_Character_$callClinit();
    return jl_Character_isHighSurrogate($high) && jl_Character_isLowSurrogate($low) ? 1 : 0;
},
jl_Character_toCodePoint = ($high, $low) => {
    jl_Character_$callClinit();
    return (($high & 1023) << 10 | $low & 1023) + 65536 | 0;
},
jl_Character_codePointAt = ($a, $index) => {
    jl_Character_$callClinit();
    return jl_Character_codePointAt0($a, $index, $a.data.length);
},
jl_Character_codePointAt0 = ($a, $index, $limit) => {
    let var$4, var$5;
    jl_Character_$callClinit();
    if ($index < $limit && $index >= 0) {
        var$4 = $a.data;
        if ($limit <= var$4.length) {
            if ($index < ($limit - 1 | 0) && jl_Character_isHighSurrogate(var$4[$index])) {
                var$5 = $index + 1 | 0;
                if (jl_Character_isLowSurrogate(var$4[var$5]))
                    return jl_Character_toCodePoint(var$4[$index], var$4[var$5]);
            }
            return var$4[$index];
        }
    }
    $rt_throw(jl_IndexOutOfBoundsException__init_());
},
jl_Character_highSurrogate = $codePoint => {
    let var$2;
    jl_Character_$callClinit();
    var$2 = $codePoint - 65536 | 0;
    return (55296 | var$2 >> 10 & 1023) & 65535;
},
jl_Character_lowSurrogate = $codePoint => {
    jl_Character_$callClinit();
    return (56320 | $codePoint & 1023) & 65535;
},
jl_Character_toLowerCase = $ch => {
    jl_Character_$callClinit();
    return jl_Character_toLowerCase0($ch) & 65535;
},
jl_Character_toLowerCase0 = $ch => {
    jl_Character_$callClinit();
    return jl_Character_mapChar(jl_Character_getLowerCaseMapping(), $ch);
},
jl_Character_getLowerCaseMapping = () => {
    let var$1;
    jl_Character_$callClinit();
    if (jl_Character_lowerCaseMapping === null) {
        var$1 = otciu_UnicodeHelper_decodeCaseMapping(((jl_Character_acquireLowerCaseMapping()).value !== null ? $rt_str((jl_Character_acquireLowerCaseMapping()).value) : null));
        jl_Character_lowerCaseMapping = otciu_UnicodeHelper_createCharMapping(var$1);
    }
    return jl_Character_lowerCaseMapping;
},
jl_Character_acquireLowerCaseMapping = () => {
    jl_Character_$callClinit();
    if (jl_Character_$$metadata$$0 === null)
        jl_Character_$$metadata$$0 = jl_Character_acquireLowerCaseMapping$$create();
    return jl_Character_$$metadata$$0;
},
jl_Character_toUpperCase = $ch => {
    jl_Character_$callClinit();
    return jl_Character_toUpperCase0($ch) & 65535;
},
jl_Character_toUpperCase0 = $codePoint => {
    jl_Character_$callClinit();
    return jl_Character_mapChar(jl_Character_getUpperCaseMapping(), $codePoint);
},
jl_Character_getUpperCaseMapping = () => {
    let var$1;
    jl_Character_$callClinit();
    if (jl_Character_upperCaseMapping === null) {
        var$1 = otciu_UnicodeHelper_decodeCaseMapping(((jl_Character_acquireUpperCaseMapping()).value !== null ? $rt_str((jl_Character_acquireUpperCaseMapping()).value) : null));
        jl_Character_upperCaseMapping = otciu_UnicodeHelper_createCharMapping(var$1);
    }
    return jl_Character_upperCaseMapping;
},
jl_Character_acquireUpperCaseMapping = () => {
    jl_Character_$callClinit();
    if (jl_Character_$$metadata$$1 === null)
        jl_Character_$$metadata$$1 = jl_Character_acquireUpperCaseMapping$$create();
    return jl_Character_$$metadata$$1;
},
jl_Character_mapChar = ($table, $codePoint) => {
    let $binSearchTable, $index, var$5, var$6;
    jl_Character_$callClinit();
    if ($codePoint < $table.$fastTable.data.length)
        return $codePoint + $table.$fastTable.data[$codePoint] | 0;
    $binSearchTable = $table.$binarySearchTable0;
    $index = jl_Character_binarySearchTable($binSearchTable, $codePoint);
    if ($index >= 0) {
        var$5 = $binSearchTable.data;
        var$6 = $index * 2 | 0;
        if (var$6 < var$5.length)
            return $codePoint + var$5[var$6 + 1 | 0] | 0;
    }
    return 0;
},
jl_Character_binarySearchTable = ($data, $key) => {
    let var$3, $l, $u, $i, $e, var$8;
    jl_Character_$callClinit();
    var$3 = $data.data;
    $l = 0;
    $u = (var$3.length / 2 | 0) - 1 | 0;
    while (true) {
        $i = ($l + $u | 0) / 2 | 0;
        $e = var$3[$i * 2 | 0];
        var$8 = $rt_compare($e, $key);
        if (!var$8)
            break;
        if (var$8 <= 0) {
            $l = $i + 1 | 0;
            if ($l > $u)
                return $i;
        } else {
            $u = $i - 1 | 0;
            if ($u < $l)
                return $u;
        }
    }
    return $i;
},
jl_Character_digit = ($ch, $radix) => {
    jl_Character_$callClinit();
    return jl_Character_digit0($ch, $radix);
};
let jl_Character_digit0 = ($codePoint, $radix) => {
    let $d;
    jl_Character_$callClinit();
    if ($radix >= 2 && $radix <= 36) {
        $d = jl_Character_getNumericValue($codePoint);
        if ($d >= $radix)
            $d = (-1);
        return $d;
    }
    return (-1);
},
jl_Character_getNumericValue = $codePoint => {
    let $digitMapping, var$3, $l, $u, $idx, var$7, $val, var$9;
    jl_Character_$callClinit();
    $digitMapping = jl_Character_getDigitMapping();
    var$3 = $digitMapping.data;
    $l = 0;
    $u = (var$3.length / 2 | 0) - 1 | 0;
    while ($u >= $l) {
        $idx = ($l + $u | 0) / 2 | 0;
        var$7 = $idx * 2 | 0;
        $val = var$3[var$7];
        var$9 = $rt_compare($codePoint, $val);
        if (var$9 > 0)
            $l = $idx + 1 | 0;
        else {
            if (var$9 >= 0)
                return var$3[var$7 + 1 | 0];
            $u = $idx - 1 | 0;
        }
    }
    return (-1);
},
jl_Character_forDigit = ($digit, $radix) => {
    jl_Character_$callClinit();
    if ($radix >= 2 && $radix <= 36 && $digit >= 0 && $digit < $radix)
        return $digit < 10 ? (48 + $digit | 0) & 65535 : ((97 + $digit | 0) - 10 | 0) & 65535;
    return 0;
},
jl_Character_isDigit = $codePoint => {
    jl_Character_$callClinit();
    return jl_Character_getType($codePoint) != 9 ? 0 : 1;
},
jl_Character_getDigitMapping = () => {
    jl_Character_$callClinit();
    if (jl_Character_digitMapping === null)
        jl_Character_digitMapping = otciu_UnicodeHelper_decodeIntPairsDiff(((jl_Character_obtainDigitMapping()).value !== null ? $rt_str((jl_Character_obtainDigitMapping()).value) : null));
    return jl_Character_digitMapping;
},
jl_Character_obtainDigitMapping = () => {
    jl_Character_$callClinit();
    if (jl_Character_$$metadata$$3 === null)
        jl_Character_$$metadata$$3 = jl_Character_obtainDigitMapping$$create();
    return jl_Character_$$metadata$$3;
},
jl_Character_getClasses = () => {
    jl_Character_$callClinit();
    if (jl_Character_classMapping === null)
        jl_Character_classMapping = otciu_UnicodeHelper_extractRle(((jl_Character_obtainClasses()).value !== null ? $rt_str((jl_Character_obtainClasses()).value) : null));
    return jl_Character_classMapping;
},
jl_Character_obtainClasses = () => {
    jl_Character_$callClinit();
    if (jl_Character_$$metadata$$4 === null)
        jl_Character_$$metadata$$4 = jl_Character_obtainClasses$$create();
    return jl_Character_$$metadata$$4;
},
jl_Character_toChars = $codePoint => {
    let var$2, var$3;
    jl_Character_$callClinit();
    if (!jl_Character_isValidCodePoint($codePoint))
        $rt_throw(jl_IllegalArgumentException__init_());
    if ($codePoint < 65536) {
        var$2 = $rt_createCharArray(1);
        var$2.data[0] = $codePoint & 65535;
        return var$2;
    }
    var$2 = $rt_createCharArray(2);
    var$3 = var$2.data;
    var$3[0] = jl_Character_highSurrogate($codePoint);
    var$3[1] = jl_Character_lowSurrogate($codePoint);
    return var$2;
},
jl_Character_isISOControl = $codePoint => {
    let var$2;
    jl_Character_$callClinit();
    a: {
        b: {
            if (!($codePoint >= 0 && $codePoint <= 31)) {
                if ($codePoint < 127)
                    break b;
                if ($codePoint > 159)
                    break b;
            }
            var$2 = 1;
            break a;
        }
        var$2 = 0;
    }
    return var$2;
},
jl_Character_getType0 = $c => {
    jl_Character_$callClinit();
    return jl_Character_getType($c);
},
jl_Character_getType = $codePoint => {
    let $classes, var$3, $l, $u, $i, $range;
    jl_Character_$callClinit();
    if (jl_Character_isBmpCodePoint($codePoint) && jl_Character_isSurrogate($codePoint & 65535))
        return 19;
    $classes = jl_Character_getClasses();
    var$3 = $classes.data;
    $l = 0;
    $u = var$3.length - 1 | 0;
    while ($l <= $u) {
        $i = ($l + $u | 0) / 2 | 0;
        $range = var$3[$i];
        if ($codePoint >= $range.$end1)
            $l = $i + 1 | 0;
        else {
            if ($codePoint >= $range.$start2)
                return $range.$data0.data[$codePoint - $range.$start2 | 0];
            $u = $i - 1 | 0;
        }
    }
    return 0;
},
jl_Character_isLowerCase = $codePoint => {
    jl_Character_$callClinit();
    return jl_Character_getType($codePoint) != 2 ? 0 : 1;
},
jl_Character_isUpperCase = $codePoint => {
    jl_Character_$callClinit();
    return jl_Character_getType($codePoint) != 1 ? 0 : 1;
},
jl_Character_isTitleCase = $codePoint => {
    jl_Character_$callClinit();
    return jl_Character_getType($codePoint) != 3 ? 0 : 1;
},
jl_Character_isDefined = $codePoint => {
    jl_Character_$callClinit();
    return !jl_Character_getType($codePoint) ? 0 : 1;
},
jl_Character_isLetter = $codePoint => {
    jl_Character_$callClinit();
    switch (jl_Character_getType($codePoint)) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
            break;
        default:
            return 0;
    }
    return 1;
},
jl_Character_isLetterOrDigit0 = $ch => {
    jl_Character_$callClinit();
    return jl_Character_isLetterOrDigit($ch);
},
jl_Character_isLetterOrDigit = $codePoint => {
    jl_Character_$callClinit();
    a: {
        switch (jl_Character_getType($codePoint)) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 9:
                break;
            case 6:
            case 7:
            case 8:
                break a;
            default:
                break a;
        }
        return 1;
    }
    return 0;
},
jl_Character_isJavaIdentifierStart = $codePoint => {
    jl_Character_$callClinit();
    a: {
        switch (jl_Character_getType($codePoint)) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 10:
            case 23:
            case 26:
                break;
            case 6:
            case 7:
            case 8:
            case 9:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
            case 20:
            case 21:
            case 22:
            case 24:
            case 25:
                break a;
            default:
                break a;
        }
        return 1;
    }
    return jl_Character_isIdentifierIgnorable($codePoint);
},
jl_Character_isJavaIdentifierPart = $codePoint => {
    jl_Character_$callClinit();
    a: {
        switch (jl_Character_getType($codePoint)) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 8:
            case 9:
            case 10:
            case 23:
            case 26:
                break;
            case 7:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
            case 20:
            case 21:
            case 22:
            case 24:
            case 25:
                break a;
            default:
                break a;
        }
        return 1;
    }
    return jl_Character_isIdentifierIgnorable($codePoint);
},
jl_Character_isUnicodeIdentifierStart = $codePoint => {
    jl_Character_$callClinit();
    a: {
        switch (jl_Character_getType($codePoint)) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 10:
                break;
            case 6:
            case 7:
            case 8:
            case 9:
                break a;
            default:
                break a;
        }
        return 1;
    }
    return jl_Character_isIdentifierIgnorable($codePoint);
},
jl_Character_isUnicodeIdentifierPart = $codePoint => {
    jl_Character_$callClinit();
    a: {
        switch (jl_Character_getType($codePoint)) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 8:
            case 9:
            case 10:
            case 23:
                break;
            case 7:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
            case 20:
            case 21:
            case 22:
                break a;
            default:
                break a;
        }
        return 1;
    }
    return jl_Character_isIdentifierIgnorable($codePoint);
},
jl_Character_isIdentifierIgnorable = $codePoint => {
    jl_Character_$callClinit();
    a: {
        if (!($codePoint >= 0 && $codePoint <= 8) && !($codePoint >= 14 && $codePoint <= 27)) {
            if ($codePoint < 127)
                break a;
            if ($codePoint > 159)
                break a;
        }
        return 1;
    }
    return jl_Character_getType($codePoint) != 16 ? 0 : 1;
},
jl_Character_isSpaceChar = $codePoint => {
    jl_Character_$callClinit();
    switch (jl_Character_getType($codePoint)) {
        case 12:
        case 13:
        case 14:
            break;
        default:
            return 0;
    }
    return 1;
},
jl_Character_isWhitespace0 = $ch => {
    jl_Character_$callClinit();
    return jl_Character_isWhitespace($ch);
},
jl_Character_isWhitespace = $codePoint => {
    jl_Character_$callClinit();
    switch ($codePoint) {
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
        case 28:
        case 29:
        case 30:
        case 31:
            break;
        case 160:
        case 8199:
        case 8239:
            return 0;
        default:
            return jl_Character_isSpaceChar($codePoint);
    }
    return 1;
},
jl_Character__clinit_ = () => {
    jl_Character_TYPE = $rt_cls($rt_charcls);
    jl_Character_characterCache = $rt_createArray(jl_Character, 128);
},
jl_Character_acquireLowerCaseMapping$$create = () => {
    return {"value" : "NY  H#F#U 4%F#O #F#/ d%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #a1# #%# #%# #%# %%# #%# #%# #%# #%# #%# #%# #%# %%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #<+#%# #%# #%# \'.3#%# #%# #{1#%# #w1%%# %J\'#k1#o1#%# #w1#!3# #23#*3#%# \'23#:3# #>3#%# #%# #%# #N3#%# #N3# %%# #N3#%# #J3%%# #%# #R3#%# \'%# /)#%# #)#%# #)#%# #%# #%# #%# #%# #%# #%# #%# #%# %%# #%# #%# #%# #%# #%# #%# #%# #%# %)#%# #%# #8)#L%#%# #%# #%# #"
    + "%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #a+# #%# #%# #%# #%# #%# #%# #%# #%# #%# /B45#%# #,/#645# %%# #P1#!\'#*\'#%# #%# #%# #%# #%# <-%# #%# \'%# 1&++ %_## #Z#)k%%g%% #F#W hA# 1%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# +]%# %%# #?#%# %a+\'N\'AF#b &#%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# 3%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #^#%# #%# #%# #%# #%# #%# #%# %%# #%# #%# #%# #%# #%# #%# #%"
    + "# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# %*%p kB#oq-&# _?gejg#A1 a$#%# -mo%&# {-%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# 3,4/# #%# #%"
    + "# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# 3C1 1C1 1C1 1C1 1C1 3C/ 1C1 QC1 1C1 1C1 1C%8\'%G# 7i\')G# 7C%D)\' 7C%u)%?# 7X+%P+%G# L-q*/# \'Pw/#8m/# -6## |bA G%# kC.#U !r*%&# &#%# #,05#qX\'#H.5# %%# #%# #%# #e25#D05#q25#m25# #%# %%# 1865%%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# "
    + "#%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# 1%# #%# )%# (a=%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# G%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# y%%# #%# #%# #%# #%# #%# #%# \'%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #%# 5%# #%# #4Fd#%# #%# #%# #%# #%# )%# #<{p# %%# #%# \'%# #%# #%# #%# #%# #%# #%# #%# #%# #%# #P}p#}}p#m}p#D}p#P}p# #@yp#D{p#Lyp#Br#%# #%# #%"
    + "# #%# #%# #%# #%# #%# #,%#L}p#LJd#%# #%# #$$r#%# #%# #%# #%# #%# #%# #%# #%# #P6r#}!rI )%# :GL#) i,5F#U TUg#r {%g#r >\'c#p Lnk%F# .\'F#S HB#F#b o@5F#b F#2#W 4Z;%# /%# #%# %%# \'%# M%# #%# #%# #%# \'%# #%# #%# #%# #%# #%# #%# u.#N#f "};
},
jl_Character_acquireUpperCaseMapping$$create = () => {
    return {"value" : "L[  ,%H#U :#>b# vH#O #H#/:+# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #,5# #\'# #\'# #\'# %\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# %\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# %\'# #\'# #\'#(;#N1# %\'# #\'# %\'# \'\'# +\'# %6)# \'\'#*/#N6r# %_+# %\'# #\'# #\'# %\'# )\'# %\'# \'\'# #\'# %\'# \'\'# #J%# +\'#+# #\'#+# #\'#+# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'#L\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# %\'#+# #\'# \'\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'#"
    + " #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# \'\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# 1\'# %665% #\'# )\'# #\'# #\'# #\'# #\'#o25#c25#k25#03#}1# #y1% #m1# #q1#{}p# \'y1#k}p# #$3#!$r#:{p#N}p# #,3#43#N}p#*05#B}p# %43# #B05#<3# %@3# #{!r# ){!r#F.5# %P3# #J}p#P3# \'B{p#P3#$\'#L3%,\'# +T3# 5Jyp#>yp# Z\'_\'# x\'# #\'# \'\'\' #_+\' !#a##]#\' #H#CD##H#3m%#i%% #e%#P%# \'(%#D%#C# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'#i\'#P\'#=#(+# #4)# %\'# %\'# .#H#bP\'A #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# 3\'# #\'# #\'# #\'# #\'# #\'# "
    + "#\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# %\'# #\'# #\'# #\'# #\'# #\'# #\'#`# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'% &#,%n mB#ko%x %ko%\' RAC1 >$#yu+#uu+#Pu+#Hu+%Lu+#0u+#io+#>@d# #\'- (+2Fd# \'oX\'# AJJd# N%\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #"
    + "\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# +X%# +\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'#A1 1A1 1A1 1A1 1A1 3A# #A# #A# #A% /A1 16\'%g\')B)%V+%s)%N+)A1 1A1 1A1 1A% #E# 5<m-# )E# 9A% =A% \'=# ;E# R/8## ddA )\'# @E0#U Nr,%&# #\'# \'D4"
    + "5#845# #\'# #\'# #\'# -\'# %\'# 5\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# 1\'# #\'# )\'- /qq-&# i]=\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# G\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# y%\'# #\'# #\'# #\'# #\'# #\'# #\'# \'\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'#"
    + " #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# 5\'# #\'# %\'# #\'# #\'# #\'# #\'# )\'# )\'# #\'#*%# %\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# 7\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# )\'# #\'# %\'# #\'# #\'# #\'# #\'# #\'# #\'# #\'# U\'# REJ#% -Dr# Yiejg# e*5H#U eUi#r {%i#r <\'e#t {nm%:# V%H#^ >B#H#b o@5H#b <#4#P# eV;\'# /\'# #\'# %\'# \'\'# M\'# #\'# #\'# #\'# \'\'# #\'# #\'# #\'# #\'# #\'# #\'# Z0#P#f "};
},
jl_Character_obtainDigitMapping$$create = () => {
    return {"value" : "6G*% %%%%%%%%%%%%%%%%%%A%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=,#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%_H#T#%%%%%%%%%%%%%%%%%%s+G%%%%%%%%%%%%%%%%%%_1G%%%%%%%%%%%%%%%%%%{CG%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%6)G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%*\'G%%%%%%%%%%%%%%%%%%.9G%%%%%%%%%%%%%%%%%%*\'G%%%%%%%%%%%%%%%%%%!i#G"
    + "%%%%%%%%%%%%%%%%%%c#G%%%%%%%%%%%%%%%%%%*;G%%%%%%%%%%%%%%%%%%Z+G%%%%%%%%%%%%%%%%%%:/G%%%%%%%%%%%%%%%%%%=G%%%%%%%%%%%%%%%%%%{/G%%%%%%%%%%%%%%%%%%k\'G%%%%%%%%%%%%%%%%%%s+G%%%%%%%%%%%%%%%%%%=G%%%%%%%%%%%%%%%%%%R@dG%%%%%%%%%%%%%%%%%%R[G%%%%%%%%%%%%%%%%%%c#G%%%%%%%%%%%%%%%%%%_1G%%%%%%%%%%%%%%%%%%!#G%%%%%%%%%%%%%%%%%%k\'G%%%%%%%%%%%%%%%%%%cCG%%%%%%%%%%%%%%%%%%o*IG%%%%%%%%%%%%%%%%%%A%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=,#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%c:#T#%%%%%%%%%%%%%%%%%%w&%G%%%%%"
    + "%%%%%%%%%%%%%=G%%%%%%%%%%%%%%%%%%_fG%%%%%%%%%%%%%%%%%%Z+G%%%%%%%%%%%%%%%%%%_%G%%%%%%%%%%%%%%%%%%>-G%%%%%%%%%%%%%%%%%%.9G%%%%%%%%%%%%%%%%%%w=G%%%%%%%%%%%%%%%%%%2+G%%%%%%%%%%%%%%%%%%>AG%%%%%%%%%%%%%%%%%%N)G%%%%%%%%%%%%%%%%%%=G%%%%%%%%%%%%%%%%%%%G%%%%%%%%%%%%%%%%%%B\'G%%%%%%%%%%%%%%%%%%FEG%%%%%%%%%%%%%%%%%%N)G%%%%%%%%%%%%%%%%%%oYG%%%%%%%%%%%%%%%%%%k\'G%%%%%%%%%%%%%%%%%%g5G%%%%%%%%%%%%%%%%%%*\'G%%%%%%%%%%%%%%%%%%F%G%%%%%%%%%%%%%%%%%%Z?G%%%%%%%%%%%%%%%%%%ow?G%%%%%%%%%%%%%%%%%%s4%G%%%%%%%%%%%%%%%%%%k\'G%%%%%%%%%%%%%%"
    + "%%%%s+G%%%%%%%%%%%%%%%%%%:OG%%%%%%%%%%%%%%%%%%c#G%%%%%%%%%%%%%%%%%%N&OG%%%%%%%%%%%%%%%%%%VZ%G%%%%%%%%%%%%%%%%%%%G%%%%%%%%%%%%%%%%%%%G%%%%%%%%%%%%%%%%%%%G%%%%%%%%%%%%%%%%%%%G%%%%%%%%%%%%%%%%%%!8%G%%%%%%%%%%%%%%%%%%FEG%%%%%%%%%%%%%%%%%%sKG%%%%%%%%%%%%%%%%%%k5G%%%%%%%%%%%%%%%%%%.lG%%%%%%%%%%%%%%%%%%wN)G%%%%%%%%%%%%%%%%%%"};
},
jl_Character_obtainClasses$$create = () => {
    return {"value" : "PA-Y$;Y$679:95Y#J+Y#Z$Y#B;697<8<C;6:7:PB-9[%=9<=&>:1=<=:L#<#Y#<,&?L$9B8:B(C9:C)!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!C#!#!#!#!#!#!#!#!C#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#B##!#!C$B##!#B##B$C#B%#B##B$C$B##B##!#!#B##!C#!#B##B$#!#B#C#&!C$F%!$#!$#!$#!#!#!#!#!#!#!#!C#!#!#!#!#!#!#!#!#!C#!$#!#B$#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!C(B##B#C#!#B%#!#!#!#!CgF#C;E3]%E-]/E&](%<%]2b\'Q! !#!#%<!#A#%C$9!A%]#!9B$ ! B##B2 B*CD!C#B$C$!#!#!#!#!#!#!#!#!#!#!#!C&!#:!#B#C#BTCQ!#!#!#!"
    + "#!#!#!#!#!#!#!#!#!#!#!#!#!#=G&H#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#B##!#!#!#!#!#!C#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!# BG E#Y\'CJ95E#^#; GN5\'9G#9G#9G$A\'F<A%F%Y#A,Q\'Z$Y#;Y#^#G,91Y$FA%F+G6J+Y%F#\'b&D! 9&G(1=G\'E#G#=G%F#J+F$^#&Y/ 1&\'F?G<A#b&:! G,&A/J+FBG*E#=Y$%A#\'[#F7G%%G*%G$%G&A#Y0 F:G$A#9 F,A&F9<F(Q#A&G*FJ%G91GA)FW\')\'&I$G)I%\'I#&G(F+G#Y#J+9%F0\'I#\'F)A#F#A#F7 F( &A$F%A#\'&I$G%A#I#A#I#\'&A))A%F# F$G#A#J+F#[#L\'=;&9\'& G#) F\'A%F#A#F7 F( F# F"
    + "# F#A#\' I$G#A%G#A#G$A$\'A(F% &A(J+G#F$\'9A+G#) F* F$ F7 F( F# F&A#\'&I$G& G#) I#\'A#&A0F#G#A#J+9;A(&G\' \'I# F)A#F#A#F7 F( F# F&A#\'&)\')G%A#I#A#I#\'A&G%)A%F# F$G#A#J+=&L\'A+\'& F\'A$F$ F%A$F# & F#A$F#A$F$A$F-A%I#\'I#A$I$ I$\'A#&A\')A/J+L$^\';=A&\'I$\'F) F$ F8 F1A#\'&G$I% G$ G%A(G# F$ F#A#F#G#A#J+A(9L(=&\'I#9F) F$ F8 F+ F&A#\'&)\'I& \'I# I#G#A(I#A&F$ F#G#A#J+ F#)A-G#I#F* F$ FJG#&I$G% I$ I$\'&=A%F$)L(F$G#A#J+L*=F\' \'I# F3A$F9 F* &A#F(A$\'A%I$G$ \' I)A\'J+A#I#9A-FQ\'F#G(A%;F\'%G)9J+Y#AFF# & F& F9 & F+\'F#G*&A#F& % G( J+A#F%AA&^$Y0=9^$G#^\'J"
    + "+L+=\'=\'=\'6767I#F) FEA%G/)G&9G#F&G, GE ^)\'^\' ^#Y&^%Y#AFFLI#G%)G\')G#I#G#&J+Y\'F\'I#G#F%G$&I$F#I(F$G%F.\'I#G#I\'\'&)J+I$\'^#BG !A&!A#CL9%C$b&*&  F%A#F( & F%A#FJ F%A#FB F%A#F( & F%A#F0 FZ F%A#FeA#G$Y*L5A$F1^+A\'b!7! A#C\'A#5b&M* =9F2-F;67A$FmY$K$F)A(F3G$)A*F4G#)Y#A*F3G#A-F. F$ G#A-FUG#)G(I)\'I#G,Y$%Y$;&\'A#J+A\'L+A\'Y\'5Y%G$1\'J+A\'FD%FWA\'F&G#FC\'&A&FhA+F@ G$I%G#I$A%I#\'I\'G$A%=A$Y#J+F?A#F&A,FMA%F;A\'J+,A$^CF8G#I#\'A#Y#FV)\')G( \')\'I#G)I\'G+A#\'J+A\'J+A\'Y(%Y\'A#G/(GSA0G%)FP\')G&)\'I&\'I#F) Y#J+Y(^+G*^*Y$G#)F?)G%I#G#)G$F#J+FM\')G#I$\')G$I#A)Y"
    + "%FEI)G)I#G#A$Y&J+A$F$J+F?E\'Y#C*!#A&BLA#B$Y)A)G$9G.)G(F%\'F\'\'F#)G#&A&CMEaC.%CCEFGb!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!C*!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!C*B)C\'A#B\'A#C)B)C)B)C\'A#B\'A#C) ! ! ! !C)B)C/A#C)D)C)D)C)D)C& C#B%$<#]$C$ C#B%$]$C%A#C#B% ]$C)B&]$A#C$ C#B%$]# M,Q&U\'Y#>?6_#?6>Y)./Q&-Y*>?Y%X#Y$:67Y,:98Y+-Q& Q+,%A#L\'Z$67%L+Z$67E2[FA,G."
    + "H%\'H$G-A0^#!^%!^##B$C#B$#=!^#:B&^\'!=!=!=B%=#B%#F%#^#C#B#Z&!C%=:^##=L1KD!#K%,^#A%Z&^&Z#^%:^#:^#:^(:^@Z#^#:=:^@b:-% ^)6767^5Z#^(67b=2! :^?Z:^IZ\'^jA7^,A6L^^pL7b=X# :^*:^WZ)b=P! :b=Y$ 67676767676767L?^MZ&67Z@6767676767Z1b= % b:$# 6767676767676767676767Za6767ZA67b:#% ^QZ6^#Z\'^HA#b=+# BQCQ!#B$C#!#!#!#B%#!C#!C\'E#B$#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!C#^\'!#!#G$!#A&Y%,Y#CG #A&#A#FYA(%9A/\'F8A*F( F( F( F( F( F( F( F( GAY#>?>?Y$>?9>?Y*5Y#59>?Y#>?67676767Y&%Y"
    + "+U#Y%596Y.^#Y$676767675A#Y#67A=^; b=:! A-b=7$ A;^1-Y$=%&+6767676767^#6767676756W#=K*G%I#5E&^#K$%&9^# b&7! A#G#]#E#&5b&;! 9E$&A&FL b&?!  ^#L%^+FA^GA*=F1^@ L+^?L)=L0^AL+^HL0b= & b& H!^bb&  %b&6)!%b&X2 A$^XA*FIE\'Y#b&-% %Y$F1J+F#A5!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#&\'H$9G+9%!#!#!#!#!#!#!#!#!#!#!#!#!#!#E#G#FhK+G#Y\'A)]8E*]#!#!#!#!#!#!#!C$!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#!#%C)!#!#B##!#!#!#!#%]#!#!#&!#!C$!#!#!#!#!#!#!#!#!#!#B&#B&#!#!#!#!#!#!#!#B%#!#B##!#!#!#!#!#!#!#B#A%!A/E%!#&"
    + "E##F(\'F$\'F%\'F8I#G#)^%\'A$L\'^#;=A\'FUY%A)I#FSI1G#A)Y#J+A\'G3F\'Y$&9F#\'J+F=G)Y#F8G,I#A,9F>A$G$)FP\'I#G%I#G#I$Y. %J+A%Y#F&\'%F*J+F& FJG\'I#G#I#G#A*F$\'F)\')A#J+A#Y%F1%F\'^$&)\')FS\'&G$F#G#F&G#&\'&A9F#%Y#F,)G#I#Y#&E#)\'A+F\'A#F\'A#F\'A*F( F( CL<E%C*%]#B#A#b#1! FDI#\'I#\'I#9)\'A#J+A\'b&EO#A-F8A%FRA%b4 A b3 E!b&O& A#b&K! AGC(A-C&A&&\'F+:F. F& & F# F# b&M! ]2^1b&L& 76^1Fb^#FW^)AAF-;^$G1Y(679A\'G19U#X#6767676767676767Y#67Y%X$Y$ Y%5676767Y$:5Z$ 9;Y#A%F& b&(# A#1 Y$;Y$679:95Y#J+Y#Z$Y#B;697<8<C;6:7:67967Y#F+%FNE#F@A$F\'A#F\'A#F\'A#F$A$[#:<=[# "
    + "=Z%^#A+Q$^#A#F- F; F4 F# F0A#F/ACb&]! A&Y$A%LNA$^*KVL%^2L#^$ ^.A$=AP^N\'b ## F>A$FRA0\'L<A%FAL%A*F5+F)+A&FGG&A&F? 9FEA%F)9K&AKBICIFpA#J+A\'BEA%CEA%FIA)FUA,9B, B0 B( B# C, C0 C( C#A$FUA-b&X% A*F7A+F)A9E\' EK E/AbF\'A#& FM F#A$&A#F8 9L)F8^#L(F@A)L*AQF4 F#A&L&F7L\'A$9F;A&9F;AGFYA%L#F#L1A#LO&G$ G#A&G%F% F$ F>A#G$A%\'L*A(Y*A(F>L#9F>L$AAF)=F=G#A%L&Y(A*FWA$Y(F7A#L)F4A&L)F3A(Y%A-L(b 1! FkAXBTA.CTA(L\'FEG%A)J+A\'J+F%%&B7A$G&5%C7A)Z#b 1$ L@ FK G#5A#F#A1F$%F# ]#G&9^)F7 G1F>L+&A)F7G,L%Y&A7F3G%Y%AGF6L(A5F8A*)\')FVG0Y(A%L5J+\'F#G#&"
    + "A*G$)FNI$G%I#G#Y#1Y%\'A+1A#F:A(J+A\'G$FEG&)G) J+Y%&I#&A)FD\'Y#&A*G#)FQI$G*I#F%Y%G%9)\'J+&9&Y$ L5A,F3 F:I$G$I#\')G#Y\'\'F#\'A`F( & F% F0 F+9A\'FP\'I$G)A&J+A\'G#I# F)A#F#A#F7 F( F# F& G#&I#\'I%A#I#A#I$A#&A\')A&F&I#A#G(A$G&A,F+ &A#& FG &I$G\' )A#) I% I#\')\'&\'&Y# Y#A)G#A>FVI$G)I#G$)\'F%Y&J+Y# 9\'F$A?FQI$G\')\'I%G#)G#F#9&A)J+b G# FPI$G%A#I%G#)G#Y8F%G#ACFQI$G)I#\')G#Y$&A,J+A\'Y.A4FL\')\'I#G\')\'&9A\'J+A\'J5A=F<A#\')\'I#G%)G&A%J+L#Y$=F(b Z# FMI$G*)G#9b E! BACAJ+L*A-F)A#&A#F) F# F9I\' I#A#G#)\'&)&)\'Y$A*J+AhF)A#FHI$G%A#G#I%\'&9&)A<&G+FIG\')&G%Y)\'A)"
    + "&G\'I#G$FOG.)G#Y$&Y&A.FkA(Y+&b 6! \')G$)\')b 9! FB9A/J+A\'F* FF)G( G\')\'&Y&A+J+L4A$Y#F?A#G7 )G()G#)G#AkF( F# FGG\'A$\' G# G(&\'A)J+A\'F\' F# FAI& G# I#\')\'&A(J+A\'FJ%F#A%J+b W$ F4G#I#Y#A(G#&)F. FCI#G&A$I#\')\'Y.J+\'b 6! &A0L6^)[%^2A.9b&;/ b G! b+Q! Y&K,b&%$ A-b+X% b *E b&B! Y#A.b&Q1 Q1\'F\'G0A+b&<` A&b&(* b ZK!F?G-I$G$J+b \'< b&Z) A(F@ J+A%Y#Fq J+A\'F?A#G&9A+FQG(Y&^%E%9=A+J+ L( F6A&F4b Q\' E$FIE#Y$J+A\'F9\'F%\'A#J+b 7# BACAL8Y%A&B:A#C:AMFmA%\'&IXA(G%E.AbE#9%\'A,I#E#K$A*b&<T!AEFCb @! b&T! A.b&3/ A/FTb >Y!E% E( E# b&J% A*&A>F$A#&A/F&"
    + "A(b&-\' b %E b&L! A&F.A$F*A(F+A#=G#9Q%b =_ b=Q$ J+^$A$b=U\' A\'^8 ^$A)Z$^1Z/A#GOA#G8A*b=U! A^b=W$ A+^HG#^^I#G$^$I\'Q)G)^#G(^?G%b=5# G$=A+I$^)G#^#)^AI#A`L5A-L5A-b=8! A*L:b (# B;C;B;C( C3B;C;! B#A#!A#B#A#B% B)C% # C( C,B;C;B# B%A#B) B( C;B# B% B& !A$B( C;B;C;B;C;B;C;B;C;B;C;B;C> B::C::C\'B::C::C\'B::C::C\'B::C::C\'B::C::C\'!#A#JSb= ) GX^%GS^)\'^/\'^#Y&A0G& G0b 1! Z>b D0 C+&CV!C(!#!C#!C$!C7!#!#!#!C$!#!#!#!#!#!#!#F#A/C(AWETG( G2A#G( G# G&A&E`AB\'b Q! FNA$G(E(A#J+A%&=b  & F?\'A2FMG%J+A&;b 1( F<%G%J+b 7$ F?G#&J+A%9b  $ F@ F$\'"
    + "F#\'F(G#F&\'A)&%b A$ F( F% F# F0 b&&$ A#L*G(AJBCCCG(%A%J+A%Y#b 2- L]=L$;L%AnLN=L0b #$ F% F< F# &A#& F+ F% & &A\'&A%& & & F$ F# &A#& & & & & F# &A#F% F( F% F% & F+ F2A&F$ F& F2AUZ#b /% ^MA%b=E! A-^0A#^0 ^0 ^FA+L.b=C# AX^>A.^MA%^*A(^#A/^\'b ;# b=]$ ]&b=;, A#^2A$^.A$b==$ A%^-A%^=A%^YA)^+A\'^IA)^?A#^-A%^#A/Z*AHb=9& A)^/A#^.A$^i =A$^3 ^.A$^-A&b=4#  b==! J+=b &1 b&  %b&  %b&A<#AAb&@%! b&/;!A#b&RU!A0b&O* b CG b&?) b C8 b&,.!A&b&K%#b   %b   %b \'O!b& R#b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   "
    + "%b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b   %b !0 1A?b1A! b  # b\'Q$ b   %b   %b   %b 1Y$b3  %b3  %b3  %b3`a$A#b3  %b3  %b3  %b3`a$"};
},
jur_DotAllSet = $rt_classWithoutFields(jur_JointSet),
jur_DotAllSet__init_ = $this => {
    jur_JointSet__init_($this);
},
jur_DotAllSet__init_0 = () => {
    let var_0 = new jur_DotAllSet();
    jur_DotAllSet__init_(var_0);
    return var_0;
},
jur_DotAllSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength, var$5, $high, var$7, $low;
    $strLength = $matchResult.$getRightBound();
    var$5 = $stringIndex + 1 | 0;
    if (var$5 > $strLength) {
        $matchResult.$hitEnd = 1;
        return (-1);
    }
    $high = $testString.$charAt($stringIndex);
    if (jl_Character_isHighSurrogate($high)) {
        var$7 = $stringIndex + 2 | 0;
        if (var$7 <= $strLength) {
            $low = $testString.$charAt(var$5);
            if (jl_Character_isSurrogatePair($high, $low))
                return $this.$next3.$matches(var$7, $testString, $matchResult);
        }
    }
    return $this.$next3.$matches(var$5, $testString, $matchResult);
},
jur_DotAllSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_DotAllSet_getType = $this => {
    return (-2147483602);
},
jur_DotAllSet_hasConsumed = ($this, $matchResult) => {
    return 1;
},
ju_TemplateCollections$AbstractImmutableSet = $rt_classWithoutFields(ju_AbstractSet),
ju_TemplateCollections$AbstractImmutableSet__init_ = $this => {
    ju_AbstractSet__init_($this);
},
ju_Collections$1 = $rt_classWithoutFields(ju_TemplateCollections$AbstractImmutableSet),
ju_Collections$1__init_ = $this => {
    ju_TemplateCollections$AbstractImmutableSet__init_($this);
},
ju_Collections$1__init_0 = () => {
    let var_0 = new ju_Collections$1();
    ju_Collections$1__init_(var_0);
    return var_0;
};
function jur_CICharSet() {
    let a = this; jur_LeafSet.call(a);
    a.$ch3 = 0;
    a.$supplement = 0;
}
let jur_CICharSet__init_0 = ($this, $ch) => {
    jur_LeafSet__init_($this);
    $this.$ch3 = $ch;
    $this.$supplement = jur_Pattern_getSupplement($ch);
},
jur_CICharSet__init_ = var_0 => {
    let var_1 = new jur_CICharSet();
    jur_CICharSet__init_0(var_1, var_0);
    return var_1;
},
jur_CICharSet_accepts = ($this, $strIndex, $testString) => {
    return $this.$ch3 != $testString.$charAt($strIndex) && $this.$supplement != $testString.$charAt($strIndex) ? (-1) : 1;
},
ju_Collections$2 = $rt_classWithoutFields(ju_TemplateCollections$AbstractImmutableMap),
ju_Collections$2__init_ = $this => {
    ju_TemplateCollections$AbstractImmutableMap__init_($this);
},
ju_Collections$2__init_0 = () => {
    let var_0 = new ju_Collections$2();
    ju_Collections$2__init_(var_0);
    return var_0;
};
function jur_SupplCharSet() {
    let a = this; jur_LeafSet.call(a);
    a.$high0 = 0;
    a.$low0 = 0;
    a.$ch1 = 0;
}
let jur_SupplCharSet__init_ = ($this, $ch) => {
    let $chUTF16, var$3;
    jur_LeafSet__init_($this);
    $this.$charCount0 = 2;
    $this.$ch1 = $ch;
    $chUTF16 = jl_Character_toChars($ch);
    var$3 = $chUTF16.data;
    $this.$high0 = var$3[0];
    $this.$low0 = var$3[1];
},
jur_SupplCharSet__init_0 = var_0 => {
    let var_1 = new jur_SupplCharSet();
    jur_SupplCharSet__init_(var_1, var_0);
    return var_1;
},
jur_SupplCharSet_accepts = ($this, $strIndex, $testString) => {
    let var$3, $high, $low;
    var$3 = $strIndex + 1 | 0;
    $high = $testString.$charAt($strIndex);
    $low = $testString.$charAt(var$3);
    return $this.$high0 == $high && $this.$low0 == $low ? 2 : (-1);
},
jur_SupplCharSet_find = ($this, $strIndex, $testString, $matchResult) => {
    let $testStr, $strLength, var$6, $ch;
    if (!($testString instanceof jl_String))
        return jur_AbstractSet_find($this, $strIndex, $testString, $matchResult);
    $testStr = $testString;
    $strLength = $matchResult.$getRightBound();
    while ($strIndex < $strLength) {
        var$6 = $testStr.$indexOf2($this.$high0, $strIndex);
        if (var$6 < 0)
            return (-1);
        $strIndex = var$6 + 1 | 0;
        if ($strIndex >= $strLength)
            continue;
        $ch = $testStr.$charAt($strIndex);
        if ($this.$low0 == $ch && $this.$next3.$matches($strIndex + 1 | 0, $testString, $matchResult) >= 0)
            return $strIndex + (-1) | 0;
        $strIndex = $strIndex + 1 | 0;
    }
    return (-1);
},
jur_SupplCharSet_findBack = ($this, $strIndex, $lastIndex, $testString, $matchResult) => {
    let $testStr, var$6, var$7;
    if (!($testString instanceof jl_String))
        return jur_AbstractSet_findBack($this, $strIndex, $lastIndex, $testString, $matchResult);
    $testStr = $testString;
    a: {
        while (true) {
            if ($lastIndex < $strIndex)
                return (-1);
            var$6 = $testStr.$lastIndexOf1($this.$low0, $lastIndex);
            var$7 = var$6 + (-1) | 0;
            if (var$7 < 0)
                break a;
            if (var$7 < $strIndex)
                break a;
            if ($this.$high0 == $testStr.$charAt(var$7) && $this.$next3.$matches(var$7 + 2 | 0, $testString, $matchResult) >= 0)
                break;
            $lastIndex = var$7 + (-1) | 0;
        }
        return var$7;
    }
    return (-1);
},
jur_SupplCharSet_getCodePoint = $this => {
    return $this.$ch1;
},
jur_SupplCharSet_first = ($this, $set) => {
    if ($set instanceof jur_SupplCharSet)
        return $set.$getCodePoint() != $this.$ch1 ? 0 : 1;
    if ($set instanceof jur_SupplRangeSet)
        return $set.$contains0($this.$ch1);
    if ($set instanceof jur_CharSet)
        return 0;
    if (!($set instanceof jur_RangeSet))
        return 1;
    return 0;
};
function jur_AbstractCharClass$LazyJavaLowerCase$1() {
    jur_AbstractCharClass.call(this);
    this.$this$040 = null;
}
let jur_AbstractCharClass$LazyJavaLowerCase$1__init_ = ($this, $this$0) => {
    $this.$this$040 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaLowerCase$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaLowerCase$1();
    jur_AbstractCharClass$LazyJavaLowerCase$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaLowerCase$1_contains = ($this, $ch) => {
    return jl_Character_isLowerCase($ch);
};
function cm_CubieCube() {
    let a = this; jl_Object.call(a);
    a.$ca = null;
    a.$ea = null;
    a.$temps = null;
}
let cm_CubieCube_CubeSym = null,
cm_CubieCube_moveCube = null,
cm_CubieCube_moveCubeSym = null,
cm_CubieCube_firstMoveSym = null,
cm_CubieCube_SymMult = null,
cm_CubieCube_SymMultInv = null,
cm_CubieCube_SymMove = null,
cm_CubieCube_Sym8Move = null,
cm_CubieCube_SymMoveUD = null,
cm_CubieCube_FlipS2R = null,
cm_CubieCube_TwistS2R = null,
cm_CubieCube_EPermS2R = null,
cm_CubieCube_Perm2CombP = null,
cm_CubieCube_PermInvEdgeSym = null,
cm_CubieCube_MPermInv = null,
cm_CubieCube_FlipR2S = null,
cm_CubieCube_TwistR2S = null,
cm_CubieCube_EPermR2S = null,
cm_CubieCube_FlipS2RF = null,
cm_CubieCube_SymStateTwist = null,
cm_CubieCube_SymStateFlip = null,
cm_CubieCube_SymStatePerm = null,
cm_CubieCube_urf1 = null,
cm_CubieCube_urf2 = null,
cm_CubieCube_urfMove = null,
cm_CubieCube_$callClinit = () => {
    cm_CubieCube_$callClinit = $rt_eraseClinit(cm_CubieCube);
    cm_CubieCube__clinit_();
},
cm_CubieCube_ESym2CSym = $idx => {
    cm_CubieCube_$callClinit();
    return $idx ^ 14540032 >> (($idx & 15) << 1) & 3;
},
cm_CubieCube__init_3 = $this => {
    cm_CubieCube_$callClinit();
    jl_Object__init_($this);
    $this.$ca = $rt_createByteArrayFromData([0, 1, 2, 3, 4, 5, 6, 7]);
    $this.$ea = $rt_createByteArrayFromData([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    $this.$temps = null;
},
cm_CubieCube__init_ = () => {
    let var_0 = new cm_CubieCube();
    cm_CubieCube__init_3(var_0);
    return var_0;
},
cm_CubieCube__init_1 = ($this, $cperm, $twist, $eperm, $flip) => {
    cm_CubieCube_$callClinit();
    jl_Object__init_($this);
    $this.$ca = $rt_createByteArrayFromData([0, 1, 2, 3, 4, 5, 6, 7]);
    $this.$ea = $rt_createByteArrayFromData([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    $this.$temps = null;
    $this.$setCPerm($cperm);
    $this.$setTwist($twist);
    cm_Util_setNPerm($this.$ea, $eperm, 12, 1);
    $this.$setFlip($flip);
},
cm_CubieCube__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new cm_CubieCube();
    cm_CubieCube__init_1(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
cm_CubieCube__init_4 = ($this, $c) => {
    cm_CubieCube_$callClinit();
    jl_Object__init_($this);
    $this.$ca = $rt_createByteArrayFromData([0, 1, 2, 3, 4, 5, 6, 7]);
    $this.$ea = $rt_createByteArrayFromData([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    $this.$temps = null;
    $this.$copy($c);
},
cm_CubieCube__init_2 = var_0 => {
    let var_1 = new cm_CubieCube();
    cm_CubieCube__init_4(var_1, var_0);
    return var_1;
},
cm_CubieCube_copy = ($this, $c) => {
    let $i;
    $i = 0;
    while ($i < 8) {
        $this.$ca.data[$i] = $c.$ca.data[$i];
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 12) {
        $this.$ea.data[$i] = $c.$ea.data[$i];
        $i = $i + 1 | 0;
    }
},
cm_CubieCube_invCubieCube = $this => {
    let $edge, $corn;
    if ($this.$temps === null)
        $this.$temps = cm_CubieCube__init_();
    $edge = 0;
    while ($edge < 12) {
        $this.$temps.$ea.data[$this.$ea.data[$edge] >> 1] = ($edge << 1 | $this.$ea.data[$edge] & 1) << 24 >> 24;
        $edge = ($edge + 1 | 0) << 24 >> 24;
    }
    $corn = 0;
    while ($corn < 8) {
        $this.$temps.$ca.data[$this.$ca.data[$corn] & 7] = ($corn | 32 >> ($this.$ca.data[$corn] >> 3) & 24) << 24 >> 24;
        $corn = ($corn + 1 | 0) << 24 >> 24;
    }
    $this.$copy($this.$temps);
},
cm_CubieCube_CornMult = ($a, $b, $prod) => {
    let $corn, $oriA, $oriB;
    cm_CubieCube_$callClinit();
    $corn = 0;
    while ($corn < 8) {
        $oriA = $a.$ca.data[$b.$ca.data[$corn] & 7] >> 3;
        $oriB = $b.$ca.data[$corn] >> 3;
        $prod.$ca.data[$corn] = ($a.$ca.data[$b.$ca.data[$corn] & 7] & 7 | (($oriA + $oriB | 0) % 3 | 0) << 3) << 24 >> 24;
        $corn = $corn + 1 | 0;
    }
},
cm_CubieCube_CornMultFull = ($a, $b, $prod) => {
    let $corn, $oriA, $oriB, var$7, $ori;
    cm_CubieCube_$callClinit();
    $corn = 0;
    while ($corn < 8) {
        $oriA = $a.$ca.data[$b.$ca.data[$corn] & 7] >> 3;
        $oriB = $b.$ca.data[$corn] >> 3;
        var$7 = $rt_compare($oriA, 3);
        $ori = $oriA + (var$7 < 0 ? $oriB : 6 - $oriB | 0) | 0;
        var$7 = ($ori % 3 | 0) + ((var$7 >= 0 ? 0 : 1) != ($oriB >= 3 ? 0 : 1) ? 3 : 0) | 0;
        $prod.$ca.data[$corn] = ($a.$ca.data[$b.$ca.data[$corn] & 7] & 7 | var$7 << 3) << 24 >> 24;
        $corn = $corn + 1 | 0;
    }
},
cm_CubieCube_EdgeMult = ($a, $b, $prod) => {
    let $ed;
    cm_CubieCube_$callClinit();
    $ed = 0;
    while ($ed < 12) {
        $prod.$ea.data[$ed] = ($a.$ea.data[$b.$ea.data[$ed] >> 1] ^ $b.$ea.data[$ed] & 1) << 24 >> 24;
        $ed = $ed + 1 | 0;
    }
},
cm_CubieCube_CornConjugate = ($a, $idx, $b) => {
    let $sinv, $s, $corn, $oriA, $ori;
    cm_CubieCube_$callClinit();
    $sinv = cm_CubieCube_CubeSym.data[cm_CubieCube_SymMultInv.data[0].data[$idx]];
    $s = cm_CubieCube_CubeSym.data[$idx];
    $corn = 0;
    while ($corn < 8) {
        $oriA = $sinv.$ca.data[$a.$ca.data[$s.$ca.data[$corn] & 7] & 7] >> 3;
        $ori = $a.$ca.data[$s.$ca.data[$corn] & 7] >> 3;
        if ($oriA >= 3)
            $ori = (3 - $ori | 0) % 3 | 0;
        $b.$ca.data[$corn] = ($sinv.$ca.data[$a.$ca.data[$s.$ca.data[$corn] & 7] & 7] & 7 | $ori << 3) << 24 >> 24;
        $corn = $corn + 1 | 0;
    }
},
cm_CubieCube_EdgeConjugate = ($a, $idx, $b) => {
    let $sinv, $s, $ed;
    cm_CubieCube_$callClinit();
    $sinv = cm_CubieCube_CubeSym.data[cm_CubieCube_SymMultInv.data[0].data[$idx]];
    $s = cm_CubieCube_CubeSym.data[$idx];
    $ed = 0;
    while ($ed < 12) {
        $b.$ea.data[$ed] = ($sinv.$ea.data[$a.$ea.data[$s.$ea.data[$ed] >> 1] >> 1] ^ $a.$ea.data[$s.$ea.data[$ed] >> 1] & 1 ^ $s.$ea.data[$ed] & 1) << 24 >> 24;
        $ed = $ed + 1 | 0;
    }
},
cm_CubieCube_getPermSymInv = ($idx, $sym, $isCorner) => {
    let $idxi;
    cm_CubieCube_$callClinit();
    $idxi = cm_CubieCube_PermInvEdgeSym.data[$idx];
    if ($isCorner)
        $idxi = cm_CubieCube_ESym2CSym($idxi);
    return $idxi & 65520 | cm_CubieCube_SymMult.data[$idxi & 15].data[$sym];
},
cm_CubieCube_getSkipMoves = $ssym => {
    let $ret, $i;
    cm_CubieCube_$callClinit();
    $ret = 0;
    $i = 1;
    while (true) {
        $ssym = Long_shr($ssym, 1);
        if (Long_eq($ssym, Long_ZERO))
            break;
        if (Long_eq(Long_and($ssym, Long_fromInt(1)), Long_fromInt(1)))
            $ret = $ret | cm_CubieCube_firstMoveSym.data[$i];
        $i = $i + 1 | 0;
    }
    return $ret;
},
cm_CubieCube_URFConjugate = $this => {
    if ($this.$temps === null)
        $this.$temps = cm_CubieCube__init_();
    cm_CubieCube_$callClinit();
    cm_CubieCube_CornMult(cm_CubieCube_urf2, $this, $this.$temps);
    cm_CubieCube_CornMult($this.$temps, cm_CubieCube_urf1, $this);
    cm_CubieCube_EdgeMult(cm_CubieCube_urf2, $this, $this.$temps);
    cm_CubieCube_EdgeMult($this.$temps, cm_CubieCube_urf1, $this);
},
cm_CubieCube_getFlip = $this => {
    let $idx, $i;
    $idx = 0;
    $i = 0;
    while ($i < 11) {
        $idx = $idx << 1 | $this.$ea.data[$i] & 1;
        $i = $i + 1 | 0;
    }
    return $idx;
},
cm_CubieCube_setFlip = ($this, $idx) => {
    let $parity, $i, var$4;
    $parity = 0;
    $i = 10;
    while ($i >= 0) {
        var$4 = $idx & 1;
        $parity = $parity ^ var$4;
        $this.$ea.data[$i] = ($this.$ea.data[$i] & 254 | var$4) << 24 >> 24;
        $i = $i + (-1) | 0;
        $idx = $idx >> 1;
    }
    $this.$ea.data[11] = ($this.$ea.data[11] & 254 | $parity) << 24 >> 24;
},
cm_CubieCube_getFlipSym = $this => {
    cm_CubieCube_$callClinit();
    return cm_CubieCube_FlipR2S.data[$this.$getFlip()];
},
cm_CubieCube_getTwist = $this => {
    let $idx, $i;
    $idx = 0;
    $i = 0;
    while ($i < 7) {
        $idx = $idx + (($idx << 1) + ($this.$ca.data[$i] >> 3) | 0) | 0;
        $i = $i + 1 | 0;
    }
    return $idx;
},
cm_CubieCube_setTwist = ($this, $idx) => {
    let $twst, $i, var$4;
    $twst = 15;
    $i = 6;
    while ($i >= 0) {
        var$4 = $idx % 3 | 0;
        $twst = $twst - var$4 | 0;
        $this.$ca.data[$i] = ($this.$ca.data[$i] & 7 | var$4 << 3) << 24 >> 24;
        $i = $i + (-1) | 0;
        $idx = $idx / 3 | 0;
    }
    $this.$ca.data[7] = ($this.$ca.data[7] & 7 | ($twst % 3 | 0) << 3) << 24 >> 24;
},
cm_CubieCube_getTwistSym = $this => {
    cm_CubieCube_$callClinit();
    return cm_CubieCube_TwistR2S.data[$this.$getTwist()];
},
cm_CubieCube_getUDSlice = $this => {
    return 494 - cm_Util_getComb($this.$ea, 8, 1) | 0;
};
let cm_CubieCube_setUDSlice = ($this, $idx) => {
    cm_Util_setComb($this.$ea, 494 - $idx | 0, 8, 1);
},
cm_CubieCube_getCPerm = $this => {
    return cm_Util_getNPerm($this.$ca, 8, 0);
},
cm_CubieCube_setCPerm = ($this, $idx) => {
    cm_Util_setNPerm($this.$ca, $idx, 8, 0);
},
cm_CubieCube_getCPermSym = $this => {
    cm_CubieCube_$callClinit();
    return cm_CubieCube_ESym2CSym(cm_CubieCube_EPermR2S.data[$this.$getCPerm()]);
},
cm_CubieCube_getEPerm = $this => {
    return cm_Util_getNPerm($this.$ea, 8, 1);
},
cm_CubieCube_setEPerm = ($this, $idx) => {
    cm_Util_setNPerm($this.$ea, $idx, 8, 1);
},
cm_CubieCube_getEPermSym = $this => {
    cm_CubieCube_$callClinit();
    return cm_CubieCube_EPermR2S.data[$this.$getEPerm()];
},
cm_CubieCube_getMPerm = $this => {
    return cm_Util_getNPerm($this.$ea, 12, 1) % 24 | 0;
},
cm_CubieCube_setMPerm = ($this, $idx) => {
    cm_Util_setNPerm($this.$ea, $idx, 12, 1);
},
cm_CubieCube_getCComb = $this => {
    return cm_Util_getComb($this.$ca, 0, 0);
},
cm_CubieCube_setCComb = ($this, $idx) => {
    cm_Util_setComb($this.$ca, $idx, 0, 0);
},
cm_CubieCube_verify = $this => {
    let $sum, $edgeMask, $e, $cornMask, var$5, $c;
    $sum = 0;
    $edgeMask = 0;
    $e = 0;
    while ($e < 12) {
        $edgeMask = $edgeMask | 1 << ($this.$ea.data[$e] >> 1);
        $sum = $sum ^ $this.$ea.data[$e] & 1;
        $e = $e + 1 | 0;
    }
    if ($edgeMask != 4095)
        return (-2);
    if ($sum)
        return (-3);
    $cornMask = 0;
    var$5 = 0;
    $c = 0;
    while ($c < 8) {
        $cornMask = $cornMask | 1 << ($this.$ca.data[$c] & 7);
        var$5 = var$5 + ($this.$ca.data[$c] >> 3) | 0;
        $c = $c + 1 | 0;
    }
    if ($cornMask != 255)
        return (-4);
    if (var$5 % 3 | 0)
        return (-5);
    if (!($this.$getEdgeParityBit() ^ $this.$getCornerParityBit()))
        return 0;
    return (-6);
},
cm_CubieCube_getEdgeParityBit = $this => {
    return cm_Util_getNParity(cm_Util_getNPerm($this.$ea, 12, 1), 12);
},
cm_CubieCube_getCornerParityBit = $this => {
    return cm_Util_getNParity($this.$getCPerm(), 8);
},
cm_CubieCube_selfSymmetry = $this => {
    let $c, $d, $sym, $i, var$5, var$6;
    $c = cm_CubieCube__init_2($this);
    $d = cm_CubieCube__init_();
    $sym = Long_ZERO;
    $i = 0;
    while ($i < 96) {
        var$5 = cm_CubieCube_SymMultInv.data[0].data;
        var$6 = $i % 16 | 0;
        cm_CubieCube_CornConjugate($c, var$5[var$6], $d);
        if (ju_Arrays_equals($d.$ca, $this.$ca)) {
            cm_CubieCube_EdgeConjugate($c, cm_CubieCube_SymMultInv.data[0].data[var$6], $d);
            if (ju_Arrays_equals($d.$ea, $this.$ea))
                $sym = Long_or($sym, Long_shl(Long_fromInt(1), jl_Math_min($i, 48)));
        }
        if (var$6 == 15)
            $c.$URFConjugate();
        if (($i % 48 | 0) == 47)
            $c.$invCubieCube();
        $i = $i + 1 | 0;
    }
    return $sym;
},
cm_CubieCube_initMove = () => {
    let $a, $p, var$3, var$4, var$5;
    cm_CubieCube_$callClinit();
    cm_CubieCube_moveCube.data[0] = cm_CubieCube__init_0(15120, 0, 119750400, 0);
    cm_CubieCube_moveCube.data[3] = cm_CubieCube__init_0(21021, 1494, 323403417, 0);
    cm_CubieCube_moveCube.data[6] = cm_CubieCube__init_0(8064, 1236, 29441808, 550);
    cm_CubieCube_moveCube.data[9] = cm_CubieCube__init_0(9, 0, 5880, 0);
    cm_CubieCube_moveCube.data[12] = cm_CubieCube__init_0(1230, 412, 2949660, 0);
    cm_CubieCube_moveCube.data[15] = cm_CubieCube__init_0(224, 137, 328552, 137);
    $a = 0;
    while ($a < 18) {
        $p = 0;
        while ($p < 2) {
            var$3 = cm_CubieCube_moveCube.data;
            var$4 = $a + $p | 0;
            var$5 = var$4 + 1 | 0;
            var$3[var$5] = cm_CubieCube__init_();
            cm_CubieCube_EdgeMult(cm_CubieCube_moveCube.data[var$4], cm_CubieCube_moveCube.data[$a], cm_CubieCube_moveCube.data[var$5]);
            cm_CubieCube_CornMult(cm_CubieCube_moveCube.data[var$4], cm_CubieCube_moveCube.data[$a], cm_CubieCube_moveCube.data[var$5]);
            $p = $p + 1 | 0;
        }
        $a = $a + 3 | 0;
    }
},
cm_CubieCube_initSym = () => {
    let $c, $d, $f2, $u4, $lr2, $i, var$7, var$8, $j, $k, $s, $m, var$13, var$14, var$15;
    cm_CubieCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    $f2 = cm_CubieCube__init_0(28783, 0, 259268407, 0);
    $u4 = cm_CubieCube__init_0(15138, 0, 119765538, 7);
    $lr2 = cm_CubieCube__init_0(5167, 0, 83473207, 0);
    $i = 0;
    while ($i < 8) {
        var$7 = $lr2.$ca.data;
        var$7[$i] = (var$7[$i] | 24) << 24 >> 24;
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 16) {
        cm_CubieCube_CubeSym.data[$i] = cm_CubieCube__init_2($c);
        cm_CubieCube_CornMultFull($c, $u4, $d);
        cm_CubieCube_EdgeMult($c, $u4, $d);
        if (($i % 4 | 0) == 3) {
            cm_CubieCube_CornMultFull($d, $lr2, $c);
            cm_CubieCube_EdgeMult($d, $lr2, $c);
        } else {
            var$8 = $d;
            $d = $c;
            $c = var$8;
        }
        if (($i % 8 | 0) == 7) {
            cm_CubieCube_CornMultFull($c, $f2, $d);
            cm_CubieCube_EdgeMult($c, $f2, $d);
            var$8 = $d;
            $d = $c;
            $c = var$8;
        }
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 16) {
        $j = 0;
        while ($j < 16) {
            cm_CubieCube_CornMultFull(cm_CubieCube_CubeSym.data[$i], cm_CubieCube_CubeSym.data[$j], $c);
            $k = 0;
            a: {
                while (true) {
                    if ($k >= 16)
                        break a;
                    if (ju_Arrays_equals(cm_CubieCube_CubeSym.data[$k].$ca, $c.$ca))
                        break;
                    $k = $k + 1 | 0;
                }
                cm_CubieCube_SymMult.data[$i].data[$j] = $k;
                cm_CubieCube_SymMultInv.data[$k].data[$j] = $i;
            }
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
    $j = 0;
    while ($j < 18) {
        $s = 0;
        while ($s < 16) {
            cm_CubieCube_CornConjugate(cm_CubieCube_moveCube.data[$j], cm_CubieCube_SymMultInv.data[0].data[$s], $c);
            $m = 0;
            b: {
                while (true) {
                    if ($m >= 18)
                        break b;
                    if (ju_Arrays_equals(cm_CubieCube_moveCube.data[$m].$ca, $c.$ca))
                        break;
                    $m = $m + 1 | 0;
                }
                cm_CubieCube_SymMove.data[$s].data[$j] = $m;
                var$13 = cm_CubieCube_SymMoveUD.data[$s].data;
                cm_Util_$callClinit();
                var$13[cm_Util_std2ud.data[$j]] = cm_Util_std2ud.data[$m];
            }
            if (!($s % 2 | 0))
                cm_CubieCube_Sym8Move.data[$j << 3 | $s >> 1] = cm_CubieCube_SymMove.data[$s].data[$j];
            $s = $s + 1 | 0;
        }
        $j = $j + 1 | 0;
    }
    $i = 0;
    while ($i < 18) {
        cm_CubieCube_moveCubeSym.data[$i] = cm_CubieCube_moveCube.data[$i].$selfSymmetry();
        $s = 0;
        var$14 = $i;
        while ($s < 48) {
            var$7 = cm_CubieCube_SymMove.data;
            var$15 = $s % 16 | 0;
            if (var$7[var$15].data[var$14] < $i) {
                var$7 = cm_CubieCube_firstMoveSym.data;
                var$7[$s] = var$7[$s] | 1 << $i;
            }
            if (var$15 == 15)
                var$14 = cm_CubieCube_urfMove.data[2].data[var$14];
            $s = $s + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
cm_CubieCube_initSym2Raw = ($N_RAW, $Sym2Raw, $Raw2Sym, $SymState, $coord) => {
    let $c, $d, $count, $idx, $sym_inc, $isEdge, $i, var$13, $s, var$15, $symIdx, var$17;
    cm_CubieCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    $count = 0;
    $idx = 0;
    $sym_inc = $coord < 2 ? 2 : 1;
    $isEdge = $coord == 1 ? 0 : 1;
    $i = 0;
    while ($i < $N_RAW) {
        var$13 = $Raw2Sym.data;
        if (!var$13[$i]) {
            a: {
                switch ($coord) {
                    case 0:
                        break;
                    case 1:
                        $c.$setTwist($i);
                        break a;
                    case 2:
                        $c.$setEPerm($i);
                        break a;
                    default:
                        break a;
                }
                $c.$setFlip($i);
            }
            $s = 0;
            while ($s < 16) {
                if (!$isEdge)
                    cm_CubieCube_CornConjugate($c, $s, $d);
                else
                    cm_CubieCube_EdgeConjugate($c, $s, $d);
                b: {
                    switch ($coord) {
                        case 0:
                            $idx = $d.$getFlip();
                            break b;
                        case 1:
                            $idx = $d.$getTwist();
                            break b;
                        case 2:
                            $idx = $d.$getEPerm();
                            break b;
                        default:
                    }
                }
                if (!$coord)
                    cm_CubieCube_FlipS2RF.data[$count << 3 | $s >> 1] = $idx & 65535;
                if ($idx == $i) {
                    var$15 = $SymState.data;
                    var$15[$count] = (var$15[$count] | 1 << ($s / $sym_inc | 0)) & 65535;
                }
                $symIdx = ($count << 4 | $s) / $sym_inc | 0;
                var$13[$idx] = $symIdx & 65535;
                $s = $s + $sym_inc | 0;
            }
            var$15 = $Sym2Raw.data;
            var$17 = $count + 1 | 0;
            var$15[$count] = $i & 65535;
            $count = var$17;
        }
        $i = $i + 1 | 0;
    }
    return $count;
},
cm_CubieCube_initFlipSym2Raw = () => {
    let var$1, var$2, var$3;
    cm_CubieCube_$callClinit();
    var$1 = cm_CubieCube_FlipS2R;
    var$2 = cm_CubieCube_FlipR2S;
    var$3 = $rt_createCharArray(336);
    cm_CubieCube_SymStateFlip = var$3;
    cm_CubieCube_initSym2Raw(2048, var$1, var$2, var$3, 0);
},
cm_CubieCube_initTwistSym2Raw = () => {
    let var$1, var$2, var$3;
    cm_CubieCube_$callClinit();
    var$1 = cm_CubieCube_TwistS2R;
    var$2 = cm_CubieCube_TwistR2S;
    var$3 = $rt_createCharArray(324);
    cm_CubieCube_SymStateTwist = var$3;
    cm_CubieCube_initSym2Raw(2187, var$1, var$2, var$3, 1);
},
cm_CubieCube_initPermSym2Raw = () => {
    let var$1, var$2, var$3, $cc, $i;
    cm_CubieCube_$callClinit();
    var$1 = cm_CubieCube_EPermS2R;
    var$2 = cm_CubieCube_EPermR2S;
    var$3 = $rt_createCharArray(2768);
    cm_CubieCube_SymStatePerm = var$3;
    cm_CubieCube_initSym2Raw(40320, var$1, var$2, var$3, 2);
    $cc = cm_CubieCube__init_();
    $i = 0;
    while ($i < 2768) {
        $cc.$setEPerm(cm_CubieCube_EPermS2R.data[$i]);
        cm_CubieCube_Perm2CombP.data[$i] = (cm_Util_getComb($cc.$ea, 0, 1) + (cm_Util_getNParity(cm_CubieCube_EPermS2R.data[$i], 8) * 70 | 0) | 0) << 24 >> 24;
        $cc.$invCubieCube();
        cm_CubieCube_PermInvEdgeSym.data[$i] = $cc.$getEPermSym() & 65535;
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 24) {
        $cc.$setMPerm($i);
        $cc.$invCubieCube();
        cm_CubieCube_MPermInv.data[$i] = $cc.$getMPerm() << 24 >> 24;
        $i = $i + 1 | 0;
    }
},
cm_CubieCube__clinit_ = () => {
    let var$1, var$2;
    cm_CubieCube_CubeSym = $rt_createArray(cm_CubieCube, 16);
    cm_CubieCube_moveCube = $rt_createArray(cm_CubieCube, 18);
    cm_CubieCube_moveCubeSym = $rt_createLongArray(18);
    cm_CubieCube_firstMoveSym = $rt_createIntArray(48);
    cm_CubieCube_SymMult = $rt_createIntMultiArray([16, 16]);
    cm_CubieCube_SymMultInv = $rt_createIntMultiArray([16, 16]);
    cm_CubieCube_SymMove = $rt_createIntMultiArray([18, 16]);
    cm_CubieCube_Sym8Move = $rt_createIntArray(144);
    cm_CubieCube_SymMoveUD = $rt_createIntMultiArray([18, 16]);
    cm_CubieCube_FlipS2R = $rt_createCharArray(336);
    cm_CubieCube_TwistS2R = $rt_createCharArray(324);
    cm_CubieCube_EPermS2R = $rt_createCharArray(2768);
    cm_CubieCube_Perm2CombP = $rt_createByteArray(2768);
    cm_CubieCube_PermInvEdgeSym = $rt_createCharArray(2768);
    cm_CubieCube_MPermInv = $rt_createByteArray(24);
    cm_CubieCube_FlipR2S = $rt_createCharArray(2048);
    cm_CubieCube_TwistR2S = $rt_createCharArray(2187);
    cm_CubieCube_EPermR2S = $rt_createCharArray(40320);
    cm_CubieCube_FlipS2RF = $rt_createCharArray(2688);
    cm_CubieCube_urf1 = cm_CubieCube__init_0(2531, 1373, 67026819, 1367);
    cm_CubieCube_urf2 = cm_CubieCube__init_0(2089, 1906, 322752913, 2040);
    var$1 = $rt_createArray($rt_arraycls($rt_bytecls), 6);
    var$2 = var$1.data;
    var$2[0] = $rt_createByteArrayFromData([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    var$2[1] = $rt_createByteArrayFromData([6, 7, 8, 0, 1, 2, 3, 4, 5, 15, 16, 17, 9, 10, 11, 12, 13, 14]);
    var$2[2] = $rt_createByteArrayFromData([3, 4, 5, 6, 7, 8, 0, 1, 2, 12, 13, 14, 15, 16, 17, 9, 10, 11]);
    var$2[3] = $rt_createByteArrayFromData([2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15]);
    var$2[4] = $rt_createByteArrayFromData([8, 7, 6, 2, 1, 0, 5, 4, 3, 17, 16, 15, 11, 10, 9, 14, 13, 12]);
    var$2[5] = $rt_createByteArrayFromData([5, 4, 3, 8, 7, 6, 2, 1, 0, 14, 13, 12, 17, 16, 15, 11, 10, 9]);
    cm_CubieCube_urfMove = var$1;
    cm_CubieCube_initMove();
    cm_CubieCube_initSym();
},
otrr_ReflectionInfo = $rt_classWithoutFields();
function cm_SearchWCA() {
    let a = this; cm_Search.call(a);
    a.$firstMoveFilter = null;
    a.$lastMoveFilter = null;
    a.$isAxisRestricted = 0;
    a.$startTime = Long_ZERO;
}
let cm_SearchWCA_move2str = null,
cm_SearchWCA_str2axis = null,
cm_SearchWCA_$callClinit = () => {
    cm_SearchWCA_$callClinit = $rt_eraseClinit(cm_SearchWCA);
    cm_SearchWCA__clinit_();
},
cm_SearchWCA__init_ = $this => {
    cm_SearchWCA_$callClinit();
    cm_Search__init_($this);
    $this.$startTime = Long_ZERO;
},
cm_SearchWCA__init_0 = () => {
    let var_0 = new cm_SearchWCA();
    cm_SearchWCA__init_(var_0);
    return var_0;
},
cm_SearchWCA_solution = ($this, $facelets, $maxDepth, $probeMax, $probeMin, $verbose, $firstAxisRestrictionStr, $lastAxisRestrictionStr) => {
    let $firstAxisRestriction, $i, var$10, var$11, var$12, var$13, var$14, $lastAxisRestriction;
    jl_Object_monitorEnterSync($this);
    try {
        $this.$firstMoveFilter = $rt_createIntArray(6);
        $this.$lastMoveFilter = $rt_createIntArray(6);
        $this.$isAxisRestricted = 0;
        if ($firstAxisRestrictionStr !== null) {
            cm_SearchWCA_$callClinit();
            if (!cm_SearchWCA_str2axis.$containsKey($firstAxisRestrictionStr))
                return $rt_s(276);
            $firstAxisRestriction = (cm_SearchWCA_str2axis.$get($firstAxisRestrictionStr)).$intValue();
            $i = 0;
            while ($i < 3) {
                var$10 = $this.$firstMoveFilter.data;
                var$11 = var$10[$i];
                cm_CubieCube_$callClinit();
                var$12 = cm_CubieCube_urfMove.data;
                var$13 = (3 - $i | 0) % 3 | 0;
                var$12 = var$12[var$13].data;
                var$14 = $firstAxisRestriction * 3 | 0;
                var$10[$i] = var$11 | 3591 << ((var$12[var$14] / 3 | 0) * 3 | 0);
                var$10 = $this.$lastMoveFilter.data;
                var$11 = $i + 3 | 0;
                var$10[var$11] = var$10[var$11] | 3591 << ((cm_CubieCube_urfMove.data[var$13].data[var$14] / 3 | 0) * 3 | 0);
                $i = $i + 1 | 0;
            }
            $this.$isAxisRestricted = 1;
        }
        if ($lastAxisRestrictionStr !== null) {
            cm_SearchWCA_$callClinit();
            if (!cm_SearchWCA_str2axis.$containsKey($lastAxisRestrictionStr))
                return $rt_s(276);
            $lastAxisRestriction = (cm_SearchWCA_str2axis.$get($lastAxisRestrictionStr)).$intValue();
            $i = 0;
            while ($i < 3) {
                var$10 = $this.$lastMoveFilter.data;
                var$11 = var$10[$i];
                cm_CubieCube_$callClinit();
                var$12 = cm_CubieCube_urfMove.data;
                var$14 = (3 - $i | 0) % 3 | 0;
                var$12 = var$12[var$14].data;
                var$13 = $lastAxisRestriction * 3 | 0;
                var$10[$i] = var$11 | 3591 << ((var$12[var$13] / 3 | 0) * 3 | 0);
                var$10 = $this.$firstMoveFilter.data;
                var$11 = $i + 3 | 0;
                var$10[var$11] = var$10[var$11] | 3591 << ((cm_CubieCube_urfMove.data[var$14].data[var$13] / 3 | 0) * 3 | 0);
                $i = $i + 1 | 0;
            }
            $this.$isAxisRestricted = 1;
        }
        cm_Search_init();
        $this.$startTime = jl_System_currentTimeMillis();
        return cm_Search_solution($this, $facelets, $maxDepth, $probeMax, $probeMin, $verbose);
    } finally {
        jl_Object_monitorExitSync($this);
    }
},
cm_SearchWCA_initSearch = $this => {
    cm_Search_initSearch($this);
    if ($this.$isAxisRestricted) {
        $this.$selfSym = Long_fromInt(1);
        $this.$conjMask = 0;
        $this.$maxPreMoves = $this.$conjMask <= 7 ? 20 : 0;
    }
},
cm_SearchWCA_phase1PreMoves = ($this, $maxl, $lm, $cc, $ssym) => {
    if ($maxl == ($this.$maxPreMoves - 1 | 0) && $this.$lastMoveFilter.data[$this.$urfIdx] >> $lm & 1)
        return 1;
    return cm_Search_phase1PreMoves($this, $maxl, $lm, $cc, $ssym);
},
cm_SearchWCA_phase1 = ($this, $node, $ssym, $maxl, $lm) => {
    if ($maxl == ($this.$depth1 - 1 | 0) && $this.$firstMoveFilter.data[$this.$urfIdx] >> $lm & 1)
        return 1;
    return cm_Search_phase1($this, $node, $ssym, $maxl, $lm);
},
cm_SearchWCA_initPhase2Pre = $this => {
    $this.$isRec = 0;
    if (Long_ge(Long_sub(jl_System_currentTimeMillis(), $this.$startTime), $this.$solution1 !== null ? $this.$probeMin : $this.$probeMax))
        return 0;
    $this.$probe = Long_fromInt(-1);
    return cm_Search_initPhase2Pre($this);
},
cm_SearchWCA_phase2 = ($this, $edge, $esym, $corn, $csym, $mid, $maxl, $depth, $lm) => {
    let var$9, $moveMask, $m, $midx, var$13, $cornx, $csymx, var$16, $edgex, $esymx, var$19, $edgei, $corni, $prun, var$23, var$24, $ret;
    if (!$this.$depth1 && $depth == 1) {
        var$9 = $this.$firstMoveFilter.data[$this.$urfIdx];
        cm_Util_$callClinit();
        if (var$9 >> cm_Util_ud2std.data[$lm] & 1)
            return (-1);
    }
    a: {
        if (!$edge && !$corn && !$mid) {
            if ($this.$preMoveLen <= 0) {
                var$9 = $this.$lastMoveFilter.data[$this.$urfIdx];
                cm_Util_$callClinit();
                if (var$9 >> cm_Util_ud2std.data[$lm] & 1)
                    break a;
            }
            return $maxl;
        }
    }
    cm_Util_$callClinit();
    $moveMask = cm_Util_ckmv2bit.data[$lm];
    $m = 0;
    while ($m < 10) {
        if ($moveMask >> $m & 1)
            $m = $m + (66 >> $m & 3) | 0;
        else {
            cm_CoordCube_$callClinit();
            $midx = cm_CoordCube_MPermMove.data[$mid].data[$m];
            var$13 = cm_CoordCube_CPermMove.data[$corn].data;
            cm_CubieCube_$callClinit();
            $cornx = var$13[cm_CubieCube_SymMoveUD.data[$csym].data[$m]];
            $csymx = cm_CubieCube_SymMult.data[$cornx & 15].data[$csym];
            var$16 = $cornx >> 4;
            $edgex = cm_CoordCube_EPermMove.data[$edge].data[cm_CubieCube_SymMoveUD.data[$esym].data[$m]];
            $esymx = cm_CubieCube_SymMult.data[$edgex & 15].data[$esym];
            var$19 = $edgex >> 4;
            $edgei = cm_CubieCube_getPermSymInv(var$19, $esymx, 0);
            $corni = cm_CubieCube_getPermSymInv(var$16, $csymx, 1);
            $prun = cm_CoordCube_getPruning(cm_CoordCube_EPermCCombPPrun, (($edgei >> 4) * 140 | 0) + cm_CoordCube_CCombPConj.data[cm_CubieCube_Perm2CombP.data[$corni >> 4] & 255].data[cm_CubieCube_SymMultInv.data[$edgei & 15].data[$corni & 15]] | 0);
            if ($prun > ($maxl + 1 | 0))
                return ($maxl - $prun | 0) + 1 | 0;
            if ($prun >= $maxl)
                $m = $m + (66 >> $m & 3 & ($maxl - $prun | 0)) | 0;
            else {
                var$23 = cm_CoordCube_MCPermPrun;
                var$9 = (var$16 * 24 | 0) + cm_CoordCube_MPermConj.data[$midx].data[$csymx] | 0;
                var$9 = cm_CoordCube_getPruning(var$23, var$9);
                var$23 = cm_CoordCube_EPermCCombPPrun;
                var$24 = (var$19 * 140 | 0) + cm_CoordCube_CCombPConj.data[cm_CubieCube_Perm2CombP.data[var$16] & 255].data[cm_CubieCube_SymMultInv.data[$esymx].data[$csymx]] | 0;
                var$24 = cm_CoordCube_getPruning(var$23, var$24);
                var$9 = jl_Math_max(var$9, var$24);
                if (var$9 >= $maxl)
                    $m = $m + (66 >> $m & 3 & ($maxl - var$9 | 0)) | 0;
                else {
                    $ret = $this.$phase2(var$19, $esymx, var$16, $csymx, $midx, $maxl - 1 | 0, $depth + 1 | 0, $m);
                    if ($ret >= 0) {
                        $this.$move.data[$depth] = cm_Util_ud2std.data[$m];
                        return $ret;
                    }
                }
            }
        }
        $m = $m + 1 | 0;
    }
    return (-1);
},
cm_SearchWCA_solutionToString = $this => {
    let $sb, $urf, $s, var$4, var$5;
    $sb = jl_StringBuffer__init_();
    $urf = !($this.$verbose & 2) ? $this.$urfIdx : ($this.$urfIdx + 3 | 0) % 6 | 0;
    a: {
        if ($urf >= 3) {
            $s = $this.$sol - 1 | 0;
            while (true) {
                if ($s < 0)
                    break a;
                cm_SearchWCA_$callClinit();
                var$4 = cm_SearchWCA_move2str.data;
                cm_CubieCube_$callClinit();
                ($sb.$append16(var$4[cm_CubieCube_urfMove.data[$urf].data[$this.$moveSol.data[$s]]])).$append17(32);
                if ($this.$verbose & 1 && $s == $this.$depth1)
                    $sb.$append16($rt_s(277));
                $s = $s + (-1) | 0;
            }
        }
        $s = 0;
        while ($s < $this.$sol) {
            if ($this.$verbose & 1 && $s == $this.$depth1)
                $sb.$append16($rt_s(277));
            cm_SearchWCA_$callClinit();
            var$5 = cm_SearchWCA_move2str.data;
            cm_CubieCube_$callClinit();
            ($sb.$append16(var$5[cm_CubieCube_urfMove.data[$urf].data[$this.$moveSol.data[$s]]])).$append17(32);
            $s = $s + 1 | 0;
        }
    }
    if ($this.$verbose & 4)
        (($sb.$append16($rt_s(248))).$append18($this.$sol)).$append16($rt_s(249));
    return $sb.$toString();
},
cm_SearchWCA__clinit_ = () => {
    let $i;
    cm_SearchWCA_move2str = $rt_wrapArray(jl_String, [$rt_s(17), $rt_s(18), $rt_s(19), $rt_s(20), $rt_s(21), $rt_s(22), $rt_s(23), $rt_s(24), $rt_s(25), $rt_s(62), $rt_s(234), $rt_s(235), $rt_s(222), $rt_s(237), $rt_s(238), $rt_s(228), $rt_s(240), $rt_s(241)]);
    cm_SearchWCA_str2axis = ju_HashMap__init_();
    $i = 0;
    while ($i < cm_SearchWCA_move2str.data.length) {
        cm_SearchWCA_str2axis.$put(cm_SearchWCA_move2str.data[$i], jl_Integer_valueOf(($i / 3 | 0) % 3 | 0));
        $i = $i + 1 | 0;
    }
};
function jl_Object$monitorExit$lambda$_8_1() {
    jl_Object.call(this);
    this.$_0 = null;
}
let jl_Object$monitorExit$lambda$_8_1__init_ = (var$0, var$1) => {
    jl_Object__init_(var$0);
    var$0.$_0 = var$1;
},
jl_Object$monitorExit$lambda$_8_1__init_0 = var_0 => {
    let var_1 = new jl_Object$monitorExit$lambda$_8_1();
    jl_Object$monitorExit$lambda$_8_1__init_(var_1, var_0);
    return var_1;
},
jl_Object$monitorExit$lambda$_8_1_run = var$0 => {
    jl_Object_lambda$monitorExit$2(var$0.$_0);
};
function jur_AbstractCharClass$LazyCategoryScope() {
    let a = this; jur_AbstractCharClass$LazyCharClass.call(a);
    a.$category0 = 0;
    a.$mayContainSupplCodepoints2 = 0;
    a.$containsAllSurrogates = 0;
}
let jur_AbstractCharClass$LazyCategoryScope__init_1 = ($this, $cat, $mayContainSupplCodepoints) => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
    $this.$mayContainSupplCodepoints2 = $mayContainSupplCodepoints;
    $this.$category0 = $cat;
},
jur_AbstractCharClass$LazyCategoryScope__init_ = (var_0, var_1) => {
    let var_2 = new jur_AbstractCharClass$LazyCategoryScope();
    jur_AbstractCharClass$LazyCategoryScope__init_1(var_2, var_0, var_1);
    return var_2;
},
jur_AbstractCharClass$LazyCategoryScope__init_0 = ($this, $cat, $mayContainSupplCodepoints, $containsAllSurrogates) => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
    $this.$containsAllSurrogates = $containsAllSurrogates;
    $this.$mayContainSupplCodepoints2 = $mayContainSupplCodepoints;
    $this.$category0 = $cat;
},
jur_AbstractCharClass$LazyCategoryScope__init_2 = (var_0, var_1, var_2) => {
    let var_3 = new jur_AbstractCharClass$LazyCategoryScope();
    jur_AbstractCharClass$LazyCategoryScope__init_0(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_AbstractCharClass$LazyCategoryScope_computeValue = $this => {
    let $chCl;
    $chCl = jur_UnicodeCategoryScope__init_0($this.$category0);
    if ($this.$containsAllSurrogates)
        $chCl.$lowHighSurrogates.$set(0, 2048);
    $chCl.$mayContainSupplCodepoints0 = $this.$mayContainSupplCodepoints2;
    return $chCl;
};
function jur_SupplRangeSet() {
    let a = this; jur_JointSet.call(a);
    a.$chars = null;
    a.$alt3 = 0;
}
let jur_SupplRangeSet__init_ = ($this, $cc) => {
    jur_JointSet__init_($this);
    $this.$chars = $cc.$getInstance();
    $this.$alt3 = $cc.$alt;
},
jur_SupplRangeSet__init_0 = var_0 => {
    let var_1 = new jur_SupplRangeSet();
    jur_SupplRangeSet__init_(var_1, var_0);
    return var_1;
},
jur_SupplRangeSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength, var$5, $high, $offset, var$8, $low;
    $strLength = $matchResult.$getRightBound();
    if ($stringIndex < $strLength) {
        var$5 = $stringIndex + 1 | 0;
        $high = $testString.$charAt($stringIndex);
        if ($this.$contains0($high)) {
            $offset = $this.$next3.$matches(var$5, $testString, $matchResult);
            if ($offset > 0)
                return $offset;
        }
        if (var$5 < $strLength) {
            var$8 = var$5 + 1 | 0;
            $low = $testString.$charAt(var$5);
            if (jl_Character_isSurrogatePair($high, $low) && $this.$contains0(jl_Character_toCodePoint($high, $low)))
                return $this.$next3.$matches(var$8, $testString, $matchResult);
        }
    }
    return (-1);
},
jur_SupplRangeSet_contains = ($this, $ch) => {
    return $this.$chars.$contains0($ch);
},
jur_SupplRangeSet_first = ($this, $set) => {
    if ($set instanceof jur_SupplCharSet)
        return jur_AbstractCharClass_intersects0($this.$chars, $set.$getCodePoint());
    if ($set instanceof jur_CharSet)
        return jur_AbstractCharClass_intersects0($this.$chars, $set.$getChar());
    if ($set instanceof jur_SupplRangeSet)
        return jur_AbstractCharClass_intersects($this.$chars, $set.$chars);
    if (!($set instanceof jur_RangeSet))
        return 1;
    return jur_AbstractCharClass_intersects($this.$chars, $set.$getChars());
},
jur_SupplRangeSet_getChars = $this => {
    return $this.$chars;
},
jur_SupplRangeSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_SupplRangeSet_hasConsumed = ($this, $mr) => {
    return 1;
},
jur_UCISupplRangeSet = $rt_classWithoutFields(jur_SupplRangeSet),
jur_UCISupplRangeSet__init_0 = ($this, $cc) => {
    jur_SupplRangeSet__init_($this, $cc);
},
jur_UCISupplRangeSet__init_ = var_0 => {
    let var_1 = new jur_UCISupplRangeSet();
    jur_UCISupplRangeSet__init_0(var_1, var_0);
    return var_1;
},
jur_UCISupplRangeSet_contains = ($this, $ch) => {
    return $this.$chars.$contains0(jl_Character_toLowerCase0(jl_Character_toUpperCase0($ch)));
},
jur_AbstractCharClass$LazyJavaUpperCase = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaUpperCase__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaUpperCase__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaUpperCase();
    jur_AbstractCharClass$LazyJavaUpperCase__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaUpperCase_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaUpperCase$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
},
jur_AbstractLineTerminator = $rt_classWithoutFields(),
jur_AbstractLineTerminator_unixLT = null,
jur_AbstractLineTerminator_unicodeLT = null,
jur_AbstractLineTerminator__init_ = $this => {
    jl_Object__init_($this);
},
jur_AbstractLineTerminator_getInstance = $flag => {
    if (!($flag & 1)) {
        if (jur_AbstractLineTerminator_unicodeLT !== null)
            return jur_AbstractLineTerminator_unicodeLT;
        jur_AbstractLineTerminator_unicodeLT = jur_AbstractLineTerminator$2__init_0();
        return jur_AbstractLineTerminator_unicodeLT;
    }
    if (jur_AbstractLineTerminator_unixLT !== null)
        return jur_AbstractLineTerminator_unixLT;
    jur_AbstractLineTerminator_unixLT = jur_AbstractLineTerminator$1__init_0();
    return jur_AbstractLineTerminator_unixLT;
};
function owtp_TwoByTwoCubePuzzle() {
    owtp_CubePuzzle.call(this);
    this.$twoSolver = null;
}
let owtp_TwoByTwoCubePuzzle_$assertionsDisabled = 0,
owtp_TwoByTwoCubePuzzle_$callClinit = () => {
    owtp_TwoByTwoCubePuzzle_$callClinit = $rt_eraseClinit(owtp_TwoByTwoCubePuzzle);
    owtp_TwoByTwoCubePuzzle__clinit_();
},
owtp_TwoByTwoCubePuzzle__init_ = $this => {
    owtp_TwoByTwoCubePuzzle_$callClinit();
    owtp_CubePuzzle__init_($this, 2);
    $this.$wcaMinScrambleDistance = 4;
    $this.$twoSolver = owtp_TwoByTwoSolver__init_0();
},
owtp_TwoByTwoCubePuzzle__init_0 = () => {
    let var_0 = new owtp_TwoByTwoCubePuzzle();
    owtp_TwoByTwoCubePuzzle__init_(var_0);
    return var_0;
},
owtp_TwoByTwoCubePuzzle_generateRandomMoves = ($this, $r) => {
    let $state, $scramble, $ab, $e, $$je;
    $state = $this.$twoSolver.$randomState1($r);
    $scramble = $this.$twoSolver.$generateExactly1($state, 11);
    owtp_TwoByTwoCubePuzzle_$callClinit();
    if (!owtp_TwoByTwoCubePuzzle_$assertionsDisabled && ($scramble.$split($rt_s(16))).data.length != 11)
        $rt_throw(jl_AssertionError__init_());
    $ab = new owts_AlgorithmBuilder;
    owts_AlgorithmBuilder$MergingMode_$callClinit();
    owts_AlgorithmBuilder__init_($ab, $this, owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES);
    a: {
        try {
            $ab.$appendAlgorithm($scramble);
        } catch ($$e) {
            $$je = $rt_wrapException($$e);
            if ($$je instanceof owts_InvalidMoveException) {
                $e = $$je;
                break a;
            } else {
                throw $$e;
            }
        }
        return $ab.$getStateAndGenerator();
    }
    $rt_throw(jl_RuntimeException__init_1(owts_InvalidScrambleException__init_($scramble, $e)));
},
owtp_TwoByTwoCubePuzzle_solveIn = ($this, $ps, $n) => {
    let $cs;
    $cs = $ps;
    return $this.$twoSolver.$solveIn2($cs.$toTwoByTwoState(), $n);
},
owtp_TwoByTwoCubePuzzle__clinit_ = () => {
    owtp_TwoByTwoCubePuzzle_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_TwoByTwoCubePuzzle)) ? 0 : 1;
};
function jur_HangulDecomposedCharSet() {
    let a = this; jur_JointSet.call(a);
    a.$decomposedChar = null;
    a.$decomposedCharUTF16 = null;
    a.$decomposedCharLength = 0;
}
let jur_HangulDecomposedCharSet__init_ = ($this, $decomposedChar, $decomposedCharLength) => {
    jur_JointSet__init_($this);
    $this.$decomposedChar = $decomposedChar;
    $this.$decomposedCharLength = $decomposedCharLength;
},
jur_HangulDecomposedCharSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_HangulDecomposedCharSet();
    jur_HangulDecomposedCharSet__init_(var_2, var_0, var_1);
    return var_2;
},
jur_HangulDecomposedCharSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_HangulDecomposedCharSet_getDecomposedChar = $this => {
    if ($this.$decomposedCharUTF16 === null)
        $this.$decomposedCharUTF16 = jl_String__init_0($this.$decomposedChar);
    return $this.$decomposedCharUTF16;
},
jur_HangulDecomposedCharSet_matches = ($this, $strIndex, $testString, $matchResult) => {
    let $rightBound, $syllIndex, $decompSyllable, $vIndex, $tIndex, var$9, $curSymb, $decompCurSymb, var$12, $i, var$14, $lIndex, var$16, var$17;
    $rightBound = $matchResult.$getRightBound();
    $syllIndex = 0;
    $decompSyllable = $rt_createIntArray(3);
    $vIndex = (-1);
    $tIndex = (-1);
    if ($strIndex >= $rightBound)
        return (-1);
    var$9 = $strIndex + 1 | 0;
    $curSymb = $testString.$charAt($strIndex);
    $decompCurSymb = jur_Lexer_getHangulDecomposition($curSymb);
    if ($decompCurSymb !== null) {
        var$12 = $decompCurSymb.data;
        $i = 0;
        if (var$12.length != $this.$decomposedCharLength)
            return (-1);
        while (true) {
            if ($i >= $this.$decomposedCharLength)
                return $this.$next3.$matches(var$9, $testString, $matchResult);
            if (var$12[$i] != $this.$decomposedChar.data[$i])
                break;
            $i = $i + 1 | 0;
        }
        return (-1);
    }
    var$14 = $decompSyllable.data;
    var$14[$syllIndex] = $curSymb;
    $lIndex = $curSymb - 4352 | 0;
    if ($lIndex >= 0 && $lIndex < 19) {
        if (var$9 < $rightBound) {
            $curSymb = $testString.$charAt(var$9);
            $vIndex = $curSymb - 4449 | 0;
        }
        if ($vIndex >= 0 && $vIndex < 21) {
            var$16 = var$9 + 1 | 0;
            var$14[1] = $curSymb;
            if (var$16 < $rightBound) {
                $curSymb = $testString.$charAt(var$16);
                $tIndex = $curSymb - 4519 | 0;
            }
            if ($tIndex >= 0 && $tIndex < 28) {
                var$17 = var$16 + 1 | 0;
                var$14[2] = $curSymb;
                var$17 = $this.$decomposedCharLength == 3 && var$14[0] == $this.$decomposedChar.data[0] && var$14[1] == $this.$decomposedChar.data[1] && var$14[2] == $this.$decomposedChar.data[2] ? $this.$next3.$matches(var$17, $testString, $matchResult) : (-1);
                return var$17;
            }
            var$17 = $this.$decomposedCharLength == 2 && var$14[0] == $this.$decomposedChar.data[0] && var$14[1] == $this.$decomposedChar.data[1] ? $this.$next3.$matches(var$16, $testString, $matchResult) : (-1);
            return var$17;
        }
        return (-1);
    }
    return (-1);
},
jur_HangulDecomposedCharSet_first = ($this, $set) => {
    let var$2, var$3;
    a: {
        if ($set instanceof jur_HangulDecomposedCharSet) {
            var$2 = $set;
            if (!(jur_HangulDecomposedCharSet_getDecomposedChar(var$2)).$equals(jur_HangulDecomposedCharSet_getDecomposedChar($this))) {
                var$3 = 0;
                break a;
            }
        }
        var$3 = 1;
    }
    return var$3;
},
jur_HangulDecomposedCharSet_hasConsumed = ($this, $matchResult) => {
    return 1;
},
jur_AbstractCharClass$LazyPunct = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyPunct__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyPunct__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyPunct();
    jur_AbstractCharClass$LazyPunct__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyPunct_computeValue = $this => {
    return (((jur_CharClass__init_()).$add1(33, 64)).$add1(91, 96)).$add1(123, 126);
};
function owtp_TwoByTwoSolver$TwoByTwoState() {
    let a = this; jl_Object.call(a);
    a.$permutation = 0;
    a.$orientation = 0;
}
let owtp_TwoByTwoSolver$TwoByTwoState__init_ = $this => {
    jl_Object__init_($this);
},
owtp_TwoByTwoSolver$TwoByTwoState__init_0 = () => {
    let var_0 = new owtp_TwoByTwoSolver$TwoByTwoState();
    owtp_TwoByTwoSolver$TwoByTwoState__init_(var_0);
    return var_0;
};
function jur_AbstractCharClass$LazyJavaTitleCase$1() {
    jur_AbstractCharClass.call(this);
    this.$this$020 = null;
}
let jur_AbstractCharClass$LazyJavaTitleCase$1__init_ = ($this, $this$0) => {
    $this.$this$020 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaTitleCase$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaTitleCase$1();
    jur_AbstractCharClass$LazyJavaTitleCase$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaTitleCase$1_contains = ($this, $ch) => {
    return jl_Character_isTitleCase($ch);
},
ju_Collections$_clinit_$lambda$_59_0 = $rt_classWithoutFields(),
ju_Collections$_clinit_$lambda$_59_0__init_ = var$0 => {
    jl_Object__init_(var$0);
},
ju_Collections$_clinit_$lambda$_59_0__init_0 = () => {
    let var_0 = new ju_Collections$_clinit_$lambda$_59_0();
    ju_Collections$_clinit_$lambda$_59_0__init_(var_0);
    return var_0;
};
function jur_AbstractCharClass$LazyJavaMirrored$1() {
    jur_AbstractCharClass.call(this);
    this.$this$027 = null;
}
let jur_AbstractCharClass$LazyJavaMirrored$1__init_ = ($this, $this$0) => {
    $this.$this$027 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaMirrored$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaMirrored$1();
    jur_AbstractCharClass$LazyJavaMirrored$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaMirrored$1_contains = ($this, $ch) => {
    return 0;
};
function ju_LinkedHashMapIterator() {
    let a = this; jl_Object.call(a);
    a.$base = null;
    a.$reversed0 = 0;
    a.$expectedModCount0 = 0;
    a.$futureEntry0 = null;
    a.$currentEntry0 = null;
}
let ju_LinkedHashMapIterator__init_ = ($this, $base, $reversed) => {
    jl_Object__init_($this);
    $this.$base = $base;
    $this.$reversed0 = $reversed;
    $this.$expectedModCount0 = $base.$modCount0;
    $this.$futureEntry0 = !$reversed ? $base.$head : $base.$tail;
},
ju_LinkedHashMapIterator__init_0 = (var_0, var_1) => {
    let var_2 = new ju_LinkedHashMapIterator();
    ju_LinkedHashMapIterator__init_(var_2, var_0, var_1);
    return var_2;
},
ju_LinkedHashMapIterator_hasNext = $this => {
    return $this.$futureEntry0 === null ? 0 : 1;
},
ju_LinkedHashMapIterator_checkConcurrentMod = $this => {
    if ($this.$expectedModCount0 == $this.$base.$modCount0)
        return;
    $rt_throw(ju_ConcurrentModificationException__init_());
},
ju_LinkedHashMapIterator_makeNext = $this => {
    ju_LinkedHashMapIterator_checkConcurrentMod($this);
    if (!$this.$hasNext())
        $rt_throw(ju_NoSuchElementException__init_());
    $this.$currentEntry0 = $this.$futureEntry0;
    $this.$futureEntry0 = !$this.$reversed0 ? $this.$futureEntry0.$chainForward : $this.$futureEntry0.$chainBackward;
};
function jur_AbstractCharClass$LazyJavaISOControl$1() {
    jur_AbstractCharClass.call(this);
    this.$this$041 = null;
}
let jur_AbstractCharClass$LazyJavaISOControl$1__init_ = ($this, $this$0) => {
    $this.$this$041 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaISOControl$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaISOControl$1();
    jur_AbstractCharClass$LazyJavaISOControl$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaISOControl$1_contains = ($this, $ch) => {
    return jl_Character_isISOControl($ch);
};
function jur_WordBoundary() {
    jur_AbstractSet.call(this);
    this.$positive = 0;
}
let jur_WordBoundary__init_0 = ($this, $positive) => {
    jur_AbstractSet__init_($this);
    $this.$positive = $positive;
},
jur_WordBoundary__init_ = var_0 => {
    let var_1 = new jur_WordBoundary();
    jur_WordBoundary__init_0(var_1, var_0);
    return var_1;
},
jur_WordBoundary_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $ch1, $ch2, $leftBound, $left, $right;
    $ch1 = $stringIndex < $matchResult.$getRightBound() ? $testString.$charAt($stringIndex) : 32;
    $ch2 = !$stringIndex ? 32 : $testString.$charAt($stringIndex - 1 | 0);
    $leftBound = !$matchResult.$hasTransparentBounds() ? $matchResult.$getLeftBound() : 0;
    $left = $ch1 != 32 && !jur_WordBoundary_isSpace($this, $ch1, $stringIndex, $leftBound, $testString) ? 0 : 1;
    $right = $ch2 != 32 && !jur_WordBoundary_isSpace($this, $ch2, $stringIndex - 1 | 0, $leftBound, $testString) ? 0 : 1;
    return $left ^ $right ^ $this.$positive ? (-1) : $this.$next3.$matches($stringIndex, $testString, $matchResult);
},
jur_WordBoundary_hasConsumed = ($this, $matchResult) => {
    return 0;
},
jur_WordBoundary_isSpace = ($this, $ch, $index, $leftBound, $testString) => {
    let var$5;
    if (!jl_Character_isLetterOrDigit0($ch) && $ch != 95) {
        a: {
            if (jl_Character_getType0($ch) == 6)
                while (true) {
                    $index = $index + (-1) | 0;
                    if ($index < $leftBound)
                        break a;
                    var$5 = $testString.$charAt($index);
                    if (jl_Character_isLetterOrDigit0(var$5))
                        return 0;
                    if (jl_Character_getType0(var$5) != 6)
                        return 1;
                }
        }
        return 1;
    }
    return 0;
};
function jur_UEOLSet() {
    jur_AbstractSet.call(this);
    this.$consCounter3 = 0;
}
let jur_UEOLSet__init_ = ($this, $counter) => {
    jur_AbstractSet__init_($this);
    $this.$consCounter3 = $counter;
},
jur_UEOLSet__init_0 = var_0 => {
    let var_1 = new jur_UEOLSet();
    jur_UEOLSet__init_(var_1, var_0);
    return var_1;
},
jur_UEOLSet_matches = ($this, $strIndex, $testString, $matchResult) => {
    let $rightBound;
    $rightBound = !$matchResult.$hasAnchoringBounds() ? $testString.$length() : $matchResult.$getRightBound();
    if ($strIndex >= $rightBound) {
        $matchResult.$setConsumed($this.$consCounter3, 0);
        return $this.$next3.$matches($strIndex, $testString, $matchResult);
    }
    if (($rightBound - $strIndex | 0) == 1 && $testString.$charAt($strIndex) == 10) {
        $matchResult.$setConsumed($this.$consCounter3, 1);
        return $this.$next3.$matches($strIndex + 1 | 0, $testString, $matchResult);
    }
    return (-1);
},
jur_UEOLSet_hasConsumed = ($this, $matchResult) => {
    let $res;
    $res = !$matchResult.$getConsumed($this.$consCounter3) ? 0 : 1;
    $matchResult.$setConsumed($this.$consCounter3, (-1));
    return $res;
},
jur_AbstractCharClass$LazySpace = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazySpace__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazySpace__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazySpace();
    jur_AbstractCharClass$LazySpace__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazySpace_computeValue = $this => {
    return ((jur_CharClass__init_()).$add1(9, 13)).$add0(32);
};
function ju_HashMap$1() {
    ju_AbstractSet.call(this);
    this.$this$08 = null;
}
let ju_HashMap$1__init_ = ($this, $this$0) => {
    $this.$this$08 = $this$0;
    ju_AbstractSet__init_($this);
},
ju_HashMap$1__init_0 = var_0 => {
    let var_1 = new ju_HashMap$1();
    ju_HashMap$1__init_(var_1, var_0);
    return var_1;
},
ju_HashMap$1_iterator = $this => {
    return ju_HashMap$KeyIterator__init_0($this.$this$08);
};
function jur_UCICharSet() {
    jur_LeafSet.call(this);
    this.$ch2 = 0;
}
let jur_UCICharSet__init_ = ($this, $ch) => {
    jur_LeafSet__init_($this);
    $this.$ch2 = jl_Character_toLowerCase(jl_Character_toUpperCase($ch));
},
jur_UCICharSet__init_0 = var_0 => {
    let var_1 = new jur_UCICharSet();
    jur_UCICharSet__init_(var_1, var_0);
    return var_1;
},
jur_UCICharSet_accepts = ($this, $strIndex, $testString) => {
    return $this.$ch2 != jl_Character_toLowerCase(jl_Character_toUpperCase($testString.$charAt($strIndex))) ? (-1) : 1;
},
jl_Double = $rt_classWithoutFields(jl_Number),
jl_Double_TYPE = null,
jl_Double_$callClinit = () => {
    jl_Double_$callClinit = $rt_eraseClinit(jl_Double);
    jl_Double__clinit_();
},
jl_Double_hashCode = $d => {
    let $h;
    jl_Double_$callClinit();
    $h = jl_Double_doubleToLongBits($d);
    return Long_hi($h) ^ Long_lo($h);
},
jl_Double_compare = ($a, $b) => {
    let $diff, var$4, var$5, var$6;
    jl_Double_$callClinit();
    $diff = (!($a > $b) ? 0 : 1) - (!($b > $a) ? 0 : 1) | 0;
    if (!$diff) {
        var$4 = 1.0 / $a;
        var$5 = 1.0 / $b;
        var$6 = (!(var$4 > var$5) ? 0 : 1) - (!(var$5 > var$4) ? 0 : 1) | 0;
        $diff = (var$6 + ($b !== $b ? 0 : 1) | 0) - ($a !== $a ? 0 : 1) | 0;
    }
    return $diff;
},
jl_Double_doubleToLongBits = $value => {
    jl_Double_$callClinit();
    if (!(isNaN($value) ? 1 : 0))
        return $rt_doubleToRawLongBits($value);
    return Long_create(0, 2146959360);
},
jl_Double__clinit_ = () => {
    jl_Double_TYPE = $rt_cls($rt_doublecls);
};
function jur_AtomicFSet() {
    jur_FSet.call(this);
    this.$index2 = 0;
}
let jur_AtomicFSet__init_ = ($this, $groupIndex) => {
    jur_FSet__init_($this, $groupIndex);
},
jur_AtomicFSet__init_0 = var_0 => {
    let var_1 = new jur_AtomicFSet();
    jur_AtomicFSet__init_(var_1, var_0);
    return var_1;
},
jur_AtomicFSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $gr;
    $gr = $this.$getGroupIndex();
    $matchResult.$setConsumed($gr, $stringIndex - $matchResult.$getConsumed($gr) | 0);
    $this.$index2 = $stringIndex;
    return $stringIndex;
},
jur_AtomicFSet_getIndex = $this => {
    return $this.$index2;
},
jur_AtomicFSet_hasConsumed = ($this, $mr) => {
    return 0;
};
function jur_LowSurrogateCharSet() {
    jur_JointSet.call(this);
    this.$low = 0;
}
let jur_LowSurrogateCharSet__init_0 = ($this, $low) => {
    jur_JointSet__init_($this);
    $this.$low = $low;
},
jur_LowSurrogateCharSet__init_ = var_0 => {
    let var_1 = new jur_LowSurrogateCharSet();
    jur_LowSurrogateCharSet__init_0(var_1, var_0);
    return var_1;
},
jur_LowSurrogateCharSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_LowSurrogateCharSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let var$4, $low, $high;
    var$4 = $stringIndex + 1 | 0;
    if (var$4 > $matchResult.$getRightBound()) {
        $matchResult.$hitEnd = 1;
        return (-1);
    }
    $low = $testString.$charAt($stringIndex);
    if ($stringIndex > $matchResult.$getLeftBound()) {
        $high = $testString.$charAt($stringIndex - 1 | 0);
        if (jl_Character_isHighSurrogate($high))
            return (-1);
    }
    if ($this.$low != $low)
        return (-1);
    return $this.$next3.$matches(var$4, $testString, $matchResult);
},
jur_LowSurrogateCharSet_find = ($this, $strIndex, $testString, $matchResult) => {
    let $testStr, $startStr, $strLength, var$7, var$8;
    if (!($testString instanceof jl_String))
        return jur_AbstractSet_find($this, $strIndex, $testString, $matchResult);
    $testStr = $testString;
    $startStr = $matchResult.$getLeftBound();
    $strLength = $matchResult.$getRightBound();
    while (true) {
        if ($strIndex >= $strLength)
            return (-1);
        var$7 = $testStr.$indexOf2($this.$low, $strIndex);
        if (var$7 < 0)
            return (-1);
        if (var$7 > $startStr && jl_Character_isHighSurrogate($testStr.$charAt(var$7 - 1 | 0))) {
            $strIndex = var$7 + 1 | 0;
            continue;
        }
        var$8 = $this.$next3;
        $strIndex = var$7 + 1 | 0;
        if (var$8.$matches($strIndex, $testString, $matchResult) >= 0)
            break;
    }
    return var$7;
},
jur_LowSurrogateCharSet_findBack = ($this, $strIndex, $lastIndex, $testString, $matchResult) => {
    let $startStr, $testStr, var$7;
    if (!($testString instanceof jl_String))
        return jur_AbstractSet_findBack($this, $strIndex, $lastIndex, $testString, $matchResult);
    $startStr = $matchResult.$getLeftBound();
    $testStr = $testString;
    a: {
        while (true) {
            if ($lastIndex < $strIndex)
                return (-1);
            var$7 = $testStr.$lastIndexOf1($this.$low, $lastIndex);
            if (var$7 < 0)
                break a;
            if (var$7 < $strIndex)
                break a;
            if (var$7 > $startStr && jl_Character_isHighSurrogate($testStr.$charAt(var$7 - 1 | 0))) {
                $lastIndex = var$7 + (-2) | 0;
                continue;
            }
            if ($this.$next3.$matches(var$7 + 1 | 0, $testString, $matchResult) >= 0)
                break;
            $lastIndex = var$7 + (-1) | 0;
        }
        return var$7;
    }
    return (-1);
},
jur_LowSurrogateCharSet_first = ($this, $set) => {
    if ($set instanceof jur_CharSet)
        return 0;
    if ($set instanceof jur_RangeSet)
        return 0;
    if ($set instanceof jur_SupplRangeSet)
        return 0;
    if ($set instanceof jur_SupplCharSet)
        return 0;
    if ($set instanceof jur_HighSurrogateCharSet)
        return 0;
    if (!($set instanceof jur_LowSurrogateCharSet))
        return 1;
    return $set.$low != $this.$low ? 0 : 1;
},
jur_LowSurrogateCharSet_hasConsumed = ($this, $matchResult) => {
    return 1;
},
jl_Error = $rt_classWithoutFields(jl_Throwable),
jl_Error__init_ = $this => {
    jl_Throwable__init_($this);
},
jl_Error__init_2 = () => {
    let var_0 = new jl_Error();
    jl_Error__init_(var_0);
    return var_0;
},
jl_Error__init_0 = ($this, $message) => {
    jl_Throwable__init_0($this, $message);
},
jl_Error__init_1 = var_0 => {
    let var_1 = new jl_Error();
    jl_Error__init_0(var_1, var_0);
    return var_1;
},
jl_AssertionError = $rt_classWithoutFields(jl_Error),
jl_AssertionError__init_1 = $this => {
    jl_Error__init_($this);
},
jl_AssertionError__init_ = () => {
    let var_0 = new jl_AssertionError();
    jl_AssertionError__init_1(var_0);
    return var_0;
},
jl_AssertionError__init_0 = ($this, $message) => {
    jl_Error__init_0($this, jl_String_valueOf($message));
},
jl_AssertionError__init_2 = var_0 => {
    let var_1 = new jl_AssertionError();
    jl_AssertionError__init_0(var_1, var_0);
    return var_1;
};
function jur_CompositeGroupQuantifierSet() {
    let a = this; jur_GroupQuantifierSet.call(a);
    a.$quantifier0 = null;
    a.$setCounter = 0;
}
let jur_CompositeGroupQuantifierSet__init_ = ($this, $quant, $innerSet, $next, $type, $setCounter) => {
    jur_GroupQuantifierSet__init_($this, $innerSet, $next, $type);
    $this.$quantifier0 = $quant;
    $this.$setCounter = $setCounter;
},
jur_CompositeGroupQuantifierSet__init_0 = (var_0, var_1, var_2, var_3, var_4) => {
    let var_5 = new jur_CompositeGroupQuantifierSet();
    jur_CompositeGroupQuantifierSet__init_(var_5, var_0, var_1, var_2, var_3, var_4);
    return var_5;
},
jur_CompositeGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $enterCounter, var$5, var$6, $nextIndex;
    $enterCounter = $matchResult.$getEnterCounter($this.$setCounter);
    if (!$this.$innerSet.$hasConsumed($matchResult))
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    if ($enterCounter >= $this.$quantifier0.$max())
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    var$5 = $this.$setCounter;
    var$6 = $enterCounter + 1 | 0;
    $matchResult.$setEnterCounter(var$5, var$6);
    $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    if ($nextIndex >= 0) {
        $matchResult.$setEnterCounter($this.$setCounter, 0);
        return $nextIndex;
    }
    var$5 = $this.$setCounter;
    var$6 = var$6 + (-1) | 0;
    $matchResult.$setEnterCounter(var$5, var$6);
    if (var$6 >= $this.$quantifier0.$min())
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    $matchResult.$setEnterCounter($this.$setCounter, 0);
    return (-1);
},
jur_RelCompositeGroupQuantifierSet = $rt_classWithoutFields(jur_CompositeGroupQuantifierSet),
jur_RelCompositeGroupQuantifierSet__init_ = ($this, $quant, $innerSet, $next, $type, $setCounter) => {
    jur_CompositeGroupQuantifierSet__init_($this, $quant, $innerSet, $next, $type, $setCounter);
},
jur_RelCompositeGroupQuantifierSet__init_0 = (var_0, var_1, var_2, var_3, var_4) => {
    let var_5 = new jur_RelCompositeGroupQuantifierSet();
    jur_RelCompositeGroupQuantifierSet__init_(var_5, var_0, var_1, var_2, var_3, var_4);
    return var_5;
},
jur_RelCompositeGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $enterCounter, $nextIndex;
    $enterCounter = $matchResult.$getEnterCounter($this.$setCounter);
    if (!$this.$innerSet.$hasConsumed($matchResult))
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    if ($enterCounter >= $this.$quantifier0.$max()) {
        $matchResult.$setEnterCounter($this.$setCounter, 0);
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    }
    if ($enterCounter < $this.$quantifier0.$min()) {
        $matchResult.$setEnterCounter($this.$setCounter, $enterCounter + 1 | 0);
        $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    } else {
        $nextIndex = $this.$next3.$matches($stringIndex, $testString, $matchResult);
        if ($nextIndex >= 0) {
            $matchResult.$setEnterCounter($this.$setCounter, 0);
            return $nextIndex;
        }
        $matchResult.$setEnterCounter($this.$setCounter, $enterCounter + 1 | 0);
        $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    }
    return $nextIndex;
};
function jlr_ReferenceQueue() {
    let a = this; jl_Object.call(a);
    a.$firstCallback = null;
    a.$inner = null;
    a.$registry = null;
}
let jlr_ReferenceQueue__init_ = var$0 => {
    var$0.$inner = [];
    {
        var$0.$registry = new FinalizationRegistry(ref => {
            if (!jlr_ReferenceQueue_reportNext(var$0, ref)) {
                var$0.$inner.push(ref);
            }
        });
    }
},
jlr_ReferenceQueue__init_0 = () => {
    let var_0 = new jlr_ReferenceQueue();
    jlr_ReferenceQueue__init_(var_0);
    return var_0;
},
jlr_ReferenceQueue_poll = var$0 => {
    var value = var$0.$inner.shift();
    return typeof value !== 'undefined' ? value : null;
},
jlr_ReferenceQueue_reportNext = (var$0, $ref) => {
    let $callback;
    if (var$0.$firstCallback === null)
        return 0;
    $callback = var$0.$firstCallback;
    $callback.$complete0($ref);
    return 1;
};
function ju_TreeSet() {
    ju_AbstractSet.call(this);
    this.$map0 = null;
}
let ju_TreeSet_VALUE = null,
ju_TreeSet_$callClinit = () => {
    ju_TreeSet_$callClinit = $rt_eraseClinit(ju_TreeSet);
    ju_TreeSet__clinit_();
},
ju_TreeSet__init_ = $this => {
    ju_TreeSet_$callClinit();
    ju_AbstractSet__init_($this);
    $this.$map0 = ju_TreeMap__init_1();
},
ju_TreeSet__init_0 = () => {
    let var_0 = new ju_TreeSet();
    ju_TreeSet__init_(var_0);
    return var_0;
},
ju_TreeSet_contains = ($this, $o) => {
    return $this.$map0.$containsKey($o);
},
ju_TreeSet_size = $this => {
    return $this.$map0.$size();
},
ju_TreeSet_add = ($this, $e) => {
    let var$2;
    var$2 = $this.$map0;
    ju_TreeSet_$callClinit();
    return var$2.$put($e, ju_TreeSet_VALUE) !== null ? 0 : 1;
},
ju_TreeSet_remove = ($this, $o) => {
    let var$2;
    var$2 = $this.$map0.$remove2($o);
    ju_TreeSet_$callClinit();
    return var$2 !== ju_TreeSet_VALUE ? 0 : 1;
},
ju_TreeSet_tailSet = ($this, $fromElement) => {
    return ($this.$map0.$tailMap($fromElement, 1)).$navigableKeySet();
},
ju_TreeSet_first = $this => {
    return $this.$map0.$firstKey();
},
ju_TreeSet__clinit_ = () => {
    ju_TreeSet_VALUE = jl_Object__init_0();
};
function ju_ArrayList() {
    let a = this; ju_AbstractList.call(a);
    a.$array = null;
    a.$size1 = 0;
}
let ju_ArrayList__init_1 = $this => {
    ju_ArrayList__init_0($this, 10);
},
ju_ArrayList__init_ = () => {
    let var_0 = new ju_ArrayList();
    ju_ArrayList__init_1(var_0);
    return var_0;
},
ju_ArrayList__init_0 = ($this, $initialCapacity) => {
    ju_AbstractList__init_($this);
    if ($initialCapacity >= 0) {
        $this.$array = $rt_createArray(jl_Object, $initialCapacity);
        return;
    }
    $rt_throw(jl_IllegalArgumentException__init_());
},
ju_ArrayList__init_2 = var_0 => {
    let var_1 = new ju_ArrayList();
    ju_ArrayList__init_0(var_1, var_0);
    return var_1;
},
ju_ArrayList_ensureCapacity = ($this, $minCapacity) => {
    let $newLength;
    if ($this.$array.data.length < $minCapacity) {
        $newLength = $this.$array.data.length >= 1073741823 ? 2147483647 : jl_Math_max($minCapacity, jl_Math_max($this.$array.data.length * 2 | 0, 5));
        $this.$array = ju_Arrays_copyOf0($this.$array, $newLength);
    }
},
ju_ArrayList_get = ($this, $index) => {
    ju_ArrayList_checkIndex($this, $index);
    return $this.$array.data[$index];
},
ju_ArrayList_size = $this => {
    return $this.$size1;
},
ju_ArrayList_set = ($this, $index, $element) => {
    let $old;
    ju_ArrayList_checkIndex($this, $index);
    $old = $this.$array.data[$index];
    $this.$array.data[$index] = $element;
    return $old;
},
ju_ArrayList_add = ($this, $element) => {
    let var$2, var$3;
    $this.$ensureCapacity($this.$size1 + 1 | 0);
    var$2 = $this.$array.data;
    var$3 = $this.$size1;
    $this.$size1 = var$3 + 1 | 0;
    var$2[var$3] = $element;
    $this.$modCount = $this.$modCount + 1 | 0;
    return 1;
},
ju_ArrayList_add0 = ($this, $index, $element) => {
    let $i;
    ju_ArrayList_checkIndexForAdd($this, $index);
    $this.$ensureCapacity($this.$size1 + 1 | 0);
    $i = $this.$size1;
    while ($i > $index) {
        $this.$array.data[$i] = $this.$array.data[$i - 1 | 0];
        $i = $i + (-1) | 0;
    }
    $this.$array.data[$index] = $element;
    $this.$size1 = $this.$size1 + 1 | 0;
    $this.$modCount = $this.$modCount + 1 | 0;
},
ju_ArrayList_remove = ($this, $i) => {
    let $old, var$3, var$4, $i_0;
    ju_ArrayList_checkIndex($this, $i);
    $old = $this.$array.data[$i];
    $this.$size1 = $this.$size1 - 1 | 0;
    while ($i < $this.$size1) {
        var$3 = $this.$array.data;
        var$4 = $this.$array.data;
        $i_0 = $i + 1 | 0;
        var$3[$i] = var$4[$i_0];
        $i = $i_0;
    }
    $this.$array.data[$this.$size1] = null;
    $this.$modCount = $this.$modCount + 1 | 0;
    return $old;
},
ju_ArrayList_clear = $this => {
    ju_Arrays_fill2($this.$array, 0, $this.$size1, null);
    $this.$size1 = 0;
    $this.$modCount = $this.$modCount + 1 | 0;
},
ju_ArrayList_checkIndex = ($this, $index) => {
    if ($index >= 0 && $index < $this.$size1)
        return;
    $rt_throw(jl_IndexOutOfBoundsException__init_());
},
ju_ArrayList_checkIndexForAdd = ($this, $index) => {
    if ($index >= 0 && $index <= $this.$size1)
        return;
    $rt_throw(jl_IndexOutOfBoundsException__init_());
},
jl_IllegalMonitorStateException = $rt_classWithoutFields(jl_RuntimeException),
jl_IllegalMonitorStateException__init_ = $this => {
    jl_RuntimeException__init_($this);
},
jl_IllegalMonitorStateException__init_0 = () => {
    let var_0 = new jl_IllegalMonitorStateException();
    jl_IllegalMonitorStateException__init_(var_0);
    return var_0;
},
ju_LinkedHashMapIterator$EntryIterator = $rt_classWithoutFields(ju_LinkedHashMapIterator),
ju_LinkedHashMapIterator$EntryIterator__init_ = ($this, $map, $reversed) => {
    ju_LinkedHashMapIterator__init_($this, $map, $reversed);
},
ju_LinkedHashMapIterator$EntryIterator__init_0 = (var_0, var_1) => {
    let var_2 = new ju_LinkedHashMapIterator$EntryIterator();
    ju_LinkedHashMapIterator$EntryIterator__init_(var_2, var_0, var_1);
    return var_2;
},
ju_LinkedHashMapIterator$EntryIterator_next = $this => {
    ju_LinkedHashMapIterator_makeNext($this);
    return $this.$currentEntry0;
},
ju_LinkedHashMapIterator$EntryIterator_next0 = $this => {
    return $this.$next1();
},
jur_RelAltGroupQuantifierSet = $rt_classWithoutFields(jur_AltGroupQuantifierSet),
jur_RelAltGroupQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_AltGroupQuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_RelAltGroupQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_RelAltGroupQuantifierSet();
    jur_RelAltGroupQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_RelAltGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $nextIndex;
    if (!$this.$innerSet.$hasConsumed($matchResult))
        return $this.$next3.$matches($stringIndex, $testString, $matchResult);
    $nextIndex = $this.$next3.$matches($stringIndex, $testString, $matchResult);
    if ($nextIndex < 0)
        $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    return $nextIndex;
},
jur_IntHash = $rt_classWithoutFields();
function jl_ThreadLocal$1() {
    jl_ThreadLocal.call(this);
    this.$val$supplier = null;
}
let jl_ThreadLocal$1__init_ = ($this, var$1) => {
    $this.$val$supplier = var$1;
    jl_ThreadLocal__init_($this);
},
jl_ThreadLocal$1__init_0 = var_0 => {
    let var_1 = new jl_ThreadLocal$1();
    jl_ThreadLocal$1__init_(var_1, var_0);
    return var_1;
},
jl_ThreadLocal$1_initialValue = $this => {
    return $this.$val$supplier.$get3();
};
function jl_String() {
    jl_Object.call(this);
    this.$hashCode17 = 0;
}
let jl_String_EMPTY_CHARS = null,
jl_String_EMPTY = null,
jl_String_CASE_INSENSITIVE_ORDER = null,
jl_String_$callClinit = () => {
    jl_String_$callClinit = $rt_eraseClinit(jl_String);
    jl_String__clinit_();
},
jl_String__init_2 = $this => {
    jl_String_$callClinit();
    jl_Object__init_($this);
    $this.$nativeString = "";
},
jl_String__init_6 = () => {
    let var_0 = new jl_String();
    jl_String__init_2(var_0);
    return var_0;
},
jl_String__init_ = ($this, $characters) => {
    let var$2;
    jl_String_$callClinit();
    var$2 = $characters.data;
    jl_Object__init_($this);
    $this.$nativeString = $rt_charArrayToString($characters.data, 0, var$2.length);
},
jl_String__init_0 = var_0 => {
    let var_1 = new jl_String();
    jl_String__init_(var_1, var_0);
    return var_1;
},
jl_String__init_4 = (var$0, var$1) => {
    var$0.$nativeString = var$1;
},
jl_String__init_3 = var_0 => {
    let var_1 = new jl_String();
    jl_String__init_4(var_1, var_0);
    return var_1;
},
jl_String__init_5 = (var$0, var$1, $offset, $count) => {
    let var$4;
    jl_String_$callClinit();
    var$4 = var$1.data;
    jl_Object__init_(var$0);
    ju_Objects_checkFromIndexSize($offset, $count, var$4.length);
    var$0.$nativeString = $rt_charArrayToString(var$1.data, $offset, $count);
},
jl_String__init_1 = (var_0, var_1, var_2) => {
    let var_3 = new jl_String();
    jl_String__init_5(var_3, var_0, var_1, var_2);
    return var_3;
},
jl_String_charAt = ($this, $index) => {
    if ($index >= 0 && $index < $this.$nativeString.length)
        return $this.$nativeString.charCodeAt($index);
    $rt_throw(jl_StringIndexOutOfBoundsException__init_());
},
jl_String_length = $this => {
    return $this.$nativeString.length;
},
jl_String_isEmpty = $this => {
    return $this.$nativeString.length ? 0 : 1;
},
jl_String_startsWith = ($this, $prefix, $toffset) => {
    let $i, var$4, var$5;
    if (($toffset + $prefix.$length() | 0) > $this.$length())
        return 0;
    $i = 0;
    while ($i < $prefix.$length()) {
        var$4 = $prefix.$charAt($i);
        var$5 = $toffset + 1 | 0;
        if (var$4 != $this.$charAt($toffset))
            return 0;
        $i = $i + 1 | 0;
        $toffset = var$5;
    }
    return 1;
},
jl_String_startsWith0 = ($this, $prefix) => {
    if ($this === $prefix)
        return 1;
    return $this.$startsWith0($prefix, 0);
},
jl_String_indexOf = ($this, $ch, $fromIndex) => {
    let $i, $bmpChar, $hi, $lo;
    $i = jl_Math_max(0, $fromIndex);
    if ($ch < 65536) {
        $bmpChar = $ch & 65535;
        while (true) {
            if ($i >= $this.$nativeString.length)
                return (-1);
            if ($this.$nativeString.charCodeAt($i) == $bmpChar)
                break;
            $i = $i + 1 | 0;
        }
        return $i;
    }
    $hi = jl_Character_highSurrogate($ch);
    $lo = jl_Character_lowSurrogate($ch);
    while (true) {
        if ($i >= ($this.$nativeString.length - 1 | 0))
            return (-1);
        if ($this.$nativeString.charCodeAt($i) == $hi && $this.$nativeString.charCodeAt(($i + 1 | 0)) == $lo)
            break;
        $i = $i + 1 | 0;
    }
    return $i;
},
jl_String_indexOf1 = ($this, $ch) => {
    return $this.$indexOf2($ch, 0);
},
jl_String_lastIndexOf = ($this, $ch, $fromIndex) => {
    let $i, $bmpChar, $hi, $lo, var$7;
    $i = jl_Math_min($fromIndex, $this.$length() - 1 | 0);
    if ($ch < 65536) {
        $bmpChar = $ch & 65535;
        while (true) {
            if ($i < 0)
                return (-1);
            if ($this.$nativeString.charCodeAt($i) == $bmpChar)
                break;
            $i = $i + (-1) | 0;
        }
        return $i;
    }
    $hi = jl_Character_highSurrogate($ch);
    $lo = jl_Character_lowSurrogate($ch);
    while (true) {
        if ($i < 1)
            return (-1);
        if ($this.$nativeString.charCodeAt($i) == $lo) {
            var$7 = $i - 1 | 0;
            if ($this.$nativeString.charCodeAt(var$7) == $hi)
                break;
        }
        $i = $i + (-1) | 0;
    }
    return var$7;
},
jl_String_lastIndexOf1 = ($this, $ch) => {
    return $this.$lastIndexOf1($ch, $this.$length() - 1 | 0);
},
jl_String_indexOf0 = ($this, $str, $fromIndex) => {
    let $i, $toIndex, $j;
    $i = jl_Math_max(0, $fromIndex);
    $toIndex = $this.$length() - $str.$length() | 0;
    a: while (true) {
        if ($i > $toIndex)
            return (-1);
        $j = 0;
        while (true) {
            if ($j >= $str.$length())
                break a;
            if ($this.$charAt($i + $j | 0) != $str.$charAt($j))
                break;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
    return $i;
},
jl_String_lastIndexOf0 = ($this, $str, $fromIndex) => {
    let $i, $j;
    $i = jl_Math_min($fromIndex, $this.$length() - $str.$length() | 0);
    a: while (true) {
        if ($i < 0)
            return (-1);
        $j = 0;
        while (true) {
            if ($j >= $str.$length())
                break a;
            if ($this.$charAt($i + $j | 0) != $str.$charAt($j))
                break;
            $j = $j + 1 | 0;
        }
        $i = $i + (-1) | 0;
    }
    return $i;
},
jl_String_substring = ($this, $beginIndex, $endIndex) => {
    let $length, var$4;
    $length = $this.$nativeString.length;
    var$4 = $rt_compare($beginIndex, $endIndex);
    if (!var$4)
        return jl_String_EMPTY;
    if (!$beginIndex && $endIndex == $length)
        return $this;
    if ($beginIndex >= 0 && var$4 <= 0 && $endIndex <= $length)
        return jl_String__init_3($this.$nativeString.substring($beginIndex, $endIndex));
    $rt_throw(jl_StringIndexOutOfBoundsException__init_());
},
jl_String_substring0 = ($this, $beginIndex) => {
    return $this.$substring($beginIndex, $this.$length());
},
jl_String_subSequence = ($this, $beginIndex, $endIndex) => {
    return $this.$substring($beginIndex, $endIndex);
},
jl_String_trim = $this => {
    let $lower, $upper;
    $lower = 0;
    $upper = $this.$length() - 1 | 0;
    a: {
        while ($lower <= $upper) {
            if ($this.$charAt($lower) > 32)
                break a;
            $lower = $lower + 1 | 0;
        }
    }
    while ($lower <= $upper && $this.$charAt($upper) <= 32) {
        $upper = $upper + (-1) | 0;
    }
    return $this.$substring($lower, $upper + 1 | 0);
},
jl_String_toString = $this => {
    return $this;
},
jl_String_toCharArray = $this => {
    let $array, $i, var$3;
    $array = $rt_createCharArray($this.$nativeString.length);
    $i = 0;
    while (true) {
        var$3 = $array.data;
        if ($i >= var$3.length)
            break;
        var$3[$i] = $this.$charAt($i);
        $i = $i + 1 | 0;
    }
    return $array;
},
jl_String_valueOf = $obj => {
    jl_String_$callClinit();
    return $obj === null ? $rt_s(26) : $obj.$toString();
},
jl_String_valueOf0 = $i => {
    jl_String_$callClinit();
    return ((jl_StringBuilder__init_()).$append3($i)).$toString();
},
jl_String_equals = ($this, $other) => {
    let $str;
    if ($this === $other)
        return 1;
    if (!($other instanceof jl_String))
        return 0;
    $str = $other;
    return $this.$nativeString !== $str.$nativeString ? 0 : 1;
},
jl_String_hashCode = $this => {
    let $i;
    a: {
        if (!$this.$hashCode17) {
            $i = 0;
            while (true) {
                if ($i >= $this.$nativeString.length)
                    break a;
                $this.$hashCode17 = (31 * $this.$hashCode17 | 0) + $this.$nativeString.charCodeAt($i) | 0;
                $i = $i + 1 | 0;
            }
        }
    }
    return $this.$hashCode17;
},
jl_String_split = ($this, $regex) => {
    return jur_Pattern_split(jur_Pattern_compile($regex), $this.$toString());
},
jl_String_join = ($delimiter, $elements) => {
    let $iter, $sb;
    jl_String_$callClinit();
    $iter = $elements.$iterator();
    if (!$iter.$hasNext())
        return $rt_s(3);
    $sb = jl_StringBuilder__init_();
    $sb.$append19($iter.$next());
    while ($iter.$hasNext()) {
        $sb.$append19($delimiter);
        $sb.$append19($iter.$next());
    }
    return $sb.$toString();
},
jl_String__clinit_ = () => {
    jl_String_EMPTY_CHARS = $rt_createCharArray(0);
    jl_String_EMPTY = jl_String__init_6();
    jl_String_CASE_INSENSITIVE_ORDER = jl_String$_clinit_$lambda$_118_0__init_0();
},
jl_NegativeArraySizeException = $rt_classWithoutFields(jl_RuntimeException),
jl_NegativeArraySizeException__init_ = $this => {
    jl_RuntimeException__init_($this);
},
jl_NegativeArraySizeException__init_0 = () => {
    let var_0 = new jl_NegativeArraySizeException();
    jl_NegativeArraySizeException__init_(var_0);
    return var_0;
},
jur_ReluctantAltQuantifierSet = $rt_classWithoutFields(jur_AltQuantifierSet),
jur_ReluctantAltQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_AltQuantifierSet__init_($this, $innerSet, $next, $type);
},
jur_ReluctantAltQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_ReluctantAltQuantifierSet();
    jur_ReluctantAltQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_ReluctantAltQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $shift;
    $shift = $this.$next3.$matches($stringIndex, $testString, $matchResult);
    if ($shift >= 0)
        return $shift;
    return $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
},
jur_AbstractCharClass$LazyJavaWhitespace = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaWhitespace__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaWhitespace__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaWhitespace();
    jur_AbstractCharClass$LazyJavaWhitespace__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaWhitespace_computeValue = $this => {
    return jur_AbstractCharClass$LazyJavaWhitespace$1__init_0($this);
},
jl_UnsupportedOperationException = $rt_classWithoutFields(jl_RuntimeException),
jl_UnsupportedOperationException__init_ = $this => {
    jl_RuntimeException__init_($this);
},
jl_UnsupportedOperationException__init_0 = () => {
    let var_0 = new jl_UnsupportedOperationException();
    jl_UnsupportedOperationException__init_(var_0);
    return var_0;
};
let jur_FSet$PossessiveFSet = $rt_classWithoutFields(jur_AbstractSet),
jur_FSet$PossessiveFSet__init_ = $this => {
    jur_AbstractSet__init_($this);
},
jur_FSet$PossessiveFSet__init_0 = () => {
    let var_0 = new jur_FSet$PossessiveFSet();
    jur_FSet$PossessiveFSet__init_(var_0);
    return var_0;
},
jur_FSet$PossessiveFSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    return $stringIndex;
},
jur_FSet$PossessiveFSet_hasConsumed = ($this, $mr) => {
    return 0;
},
jl_IllegalArgumentException = $rt_classWithoutFields(jl_RuntimeException),
jl_IllegalArgumentException__init_1 = $this => {
    jl_RuntimeException__init_($this);
},
jl_IllegalArgumentException__init_ = () => {
    let var_0 = new jl_IllegalArgumentException();
    jl_IllegalArgumentException__init_1(var_0);
    return var_0;
},
jl_IllegalArgumentException__init_2 = ($this, $message) => {
    jl_RuntimeException__init_0($this, $message);
},
jl_IllegalArgumentException__init_0 = var_0 => {
    let var_1 = new jl_IllegalArgumentException();
    jl_IllegalArgumentException__init_2(var_1, var_0);
    return var_1;
},
jl_NumberFormatException = $rt_classWithoutFields(jl_IllegalArgumentException),
jl_NumberFormatException__init_1 = $this => {
    jl_IllegalArgumentException__init_1($this);
},
jl_NumberFormatException__init_2 = () => {
    let var_0 = new jl_NumberFormatException();
    jl_NumberFormatException__init_1(var_0);
    return var_0;
},
jl_NumberFormatException__init_ = ($this, $message) => {
    jl_IllegalArgumentException__init_2($this, $message);
},
jl_NumberFormatException__init_0 = var_0 => {
    let var_1 = new jl_NumberFormatException();
    jl_NumberFormatException__init_(var_1, var_0);
    return var_1;
},
jur_PosCompositeGroupQuantifierSet = $rt_classWithoutFields(jur_CompositeGroupQuantifierSet),
jur_PosCompositeGroupQuantifierSet__init_ = ($this, $quant, $innerSet, $next, $type, $setCounter) => {
    jur_CompositeGroupQuantifierSet__init_($this, $quant, $innerSet, $next, $type, $setCounter);
    jur_FSet_$callClinit();
    $innerSet.$setNext(jur_FSet_posFSet);
},
jur_PosCompositeGroupQuantifierSet__init_0 = (var_0, var_1, var_2, var_3, var_4) => {
    let var_5 = new jur_PosCompositeGroupQuantifierSet();
    jur_PosCompositeGroupQuantifierSet__init_(var_5, var_0, var_1, var_2, var_3, var_4);
    return var_5;
},
jur_PosCompositeGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $counter, $max, $nextIndex;
    $counter = 0;
    $max = $this.$quantifier0.$max();
    a: {
        while (true) {
            $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
            if ($nextIndex <= $stringIndex)
                break a;
            if ($counter >= $max)
                break;
            $counter = $counter + 1 | 0;
            $stringIndex = $nextIndex;
        }
    }
    if ($nextIndex < 0 && $counter < $this.$quantifier0.$min())
        return (-1);
    return $this.$next3.$matches($stringIndex, $testString, $matchResult);
};
function owtp_ThreeByThreeCubePuzzle() {
    owtp_CubePuzzle.call(this);
    this.$twoPhaseSearcher = null;
}
let owtp_ThreeByThreeCubePuzzle_l = null,
owtp_ThreeByThreeCubePuzzle_$assertionsDisabled = 0,
owtp_ThreeByThreeCubePuzzle_$callClinit = () => {
    owtp_ThreeByThreeCubePuzzle_$callClinit = $rt_eraseClinit(owtp_ThreeByThreeCubePuzzle);
    owtp_ThreeByThreeCubePuzzle__clinit_();
},
owtp_ThreeByThreeCubePuzzle__init_ = $this => {
    let $newMinDistance;
    owtp_ThreeByThreeCubePuzzle_$callClinit();
    owtp_CubePuzzle__init_($this, 3);
    $newMinDistance = jl_System_getenv($rt_s(278));
    if ($newMinDistance !== null)
        $this.$wcaMinScrambleDistance = jl_Integer_parseInt0($newMinDistance);
    $this.$twoPhaseSearcher = jl_ThreadLocal_withInitial(owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0__init_0());
},
owtp_ThreeByThreeCubePuzzle__init_0 = () => {
    let var_0 = new owtp_ThreeByThreeCubePuzzle();
    owtp_ThreeByThreeCubePuzzle__init_(var_0);
    return var_0;
},
owtp_ThreeByThreeCubePuzzle_solveIn0 = ($this, $ps, $n) => {
    return $this.$solveIn3($ps, $n, null, null);
},
owtp_ThreeByThreeCubePuzzle_solveIn = ($this, $ps, $n, $firstAxisRestriction, $lastAxisRestriction) => {
    let $cs, $solution;
    $cs = $ps;
    if ($cs.$equals($this.$getSolvedState0()))
        return $rt_s(3);
    $solution = (($this.$twoPhaseSearcher.$get3()).$solution0($cs.$toFaceCube(), $n, Long_fromInt(60000), Long_ZERO, 0, $firstAxisRestriction, $lastAxisRestriction)).$trim();
    if ($rt_s(246).$equals($solution))
        return null;
    if (!$solution.$startsWith1($rt_s(279)))
        return $solution;
    owtp_ThreeByThreeCubePuzzle_l.$severe(((((jl_StringBuilder__init_()).$append1($solution)).$append1($rt_s(280))).$append1($cs.$toFaceCube())).$toString());
    if (owtp_ThreeByThreeCubePuzzle_$assertionsDisabled)
        return null;
    $rt_throw(jl_AssertionError__init_());
},
owtp_ThreeByThreeCubePuzzle_generateRandomMoves = ($this, $r, $firstAxisRestriction, $lastAxisRestriction) => {
    let $randomState, $scramble, $ab, $e, $$je;
    $randomState = cm_Tools_randomCube($r);
    $scramble = (($this.$twoPhaseSearcher.$get3()).$solution0($randomState, 21, Long_fromInt(60000), Long_fromInt(200), 2, $firstAxisRestriction, $lastAxisRestriction)).$trim();
    $ab = new owts_AlgorithmBuilder;
    owts_AlgorithmBuilder$MergingMode_$callClinit();
    owts_AlgorithmBuilder__init_($ab, $this, owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES);
    a: {
        try {
            $ab.$appendAlgorithm($scramble);
        } catch ($$e) {
            $$je = $rt_wrapException($$e);
            if ($$je instanceof owts_InvalidMoveException) {
                $e = $$je;
                break a;
            } else {
                throw $$e;
            }
        }
        return $ab.$getStateAndGenerator();
    }
    $rt_throw(jl_RuntimeException__init_1(owts_InvalidScrambleException__init_($scramble, $e)));
},
owtp_ThreeByThreeCubePuzzle_generateRandomMoves0 = ($this, $r) => {
    return $this.$generateRandomMoves0($r, null, null);
},
owtp_ThreeByThreeCubePuzzle__clinit_ = () => {
    owtp_ThreeByThreeCubePuzzle_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_ThreeByThreeCubePuzzle)) ? 0 : 1;
    owtp_ThreeByThreeCubePuzzle_l = jul_Logger_getLogger(jl_Class_getName($rt_cls(owtp_ThreeByThreeCubePuzzle)));
};
function jur_MultiLineEOLSet() {
    jur_AbstractSet.call(this);
    this.$consCounter = 0;
}
let jur_MultiLineEOLSet__init_ = ($this, $counter) => {
    jur_AbstractSet__init_($this);
    $this.$consCounter = $counter;
},
jur_MultiLineEOLSet__init_0 = var_0 => {
    let var_1 = new jur_MultiLineEOLSet();
    jur_MultiLineEOLSet__init_(var_1, var_0);
    return var_1;
},
jur_MultiLineEOLSet_matches = ($this, $strIndex, $testString, $matchResult) => {
    let $strDif, $ch1, $ch2;
    $strDif = !$matchResult.$hasAnchoringBounds() ? $testString.$length() - $strIndex | 0 : $matchResult.$getRightBound() - $strIndex | 0;
    if (!$strDif) {
        $matchResult.$setConsumed($this.$consCounter, 0);
        return $this.$next3.$matches($strIndex, $testString, $matchResult);
    }
    if ($strDif < 2) {
        $ch1 = $testString.$charAt($strIndex);
        $ch2 = 97;
    } else {
        $ch1 = $testString.$charAt($strIndex);
        $ch2 = $testString.$charAt($strIndex + 1 | 0);
    }
    switch ($ch1) {
        case 10:
        case 133:
        case 8232:
        case 8233:
            $matchResult.$setConsumed($this.$consCounter, 0);
            return $this.$next3.$matches($strIndex, $testString, $matchResult);
        case 13:
            if ($ch2 != 10) {
                $matchResult.$setConsumed($this.$consCounter, 0);
                return $this.$next3.$matches($strIndex, $testString, $matchResult);
            }
            $matchResult.$setConsumed($this.$consCounter, 0);
            return $this.$next3.$matches($strIndex, $testString, $matchResult);
        default:
    }
    return (-1);
},
jur_MultiLineEOLSet_hasConsumed = ($this, $matchResult) => {
    let $res;
    $res = !$matchResult.$getConsumed($this.$consCounter) ? 0 : 1;
    $matchResult.$setConsumed($this.$consCounter, (-1));
    return $res;
},
jur_IntArrHash = $rt_classWithoutFields();
function ju_ArrayDeque() {
    let a = this; ju_AbstractCollection.call(a);
    a.$version = 0;
    a.$array0 = null;
    a.$head0 = 0;
    a.$tail0 = 0;
}
let ju_ArrayDeque__init_0 = $this => {
    ju_ArrayDeque__init_($this, 8);
},
ju_ArrayDeque__init_1 = () => {
    let var_0 = new ju_ArrayDeque();
    ju_ArrayDeque__init_0(var_0);
    return var_0;
},
ju_ArrayDeque__init_ = ($this, $numElements) => {
    ju_AbstractCollection__init_($this);
    $this.$array0 = $rt_createArray(jl_Object, $numElements + 1 | 0);
},
ju_ArrayDeque__init_2 = var_0 => {
    let var_1 = new ju_ArrayDeque();
    ju_ArrayDeque__init_(var_1, var_0);
    return var_1;
},
ju_ArrayDeque_addLast = ($this, $e) => {
    ju_Objects_requireNonNull($e);
    ju_ArrayDeque_ensureCapacity($this, $this.$size() + 1 | 0);
    $this.$array0.data[$this.$tail0] = $e;
    $this.$tail0 = ju_ArrayDeque_modInc($this.$tail0, $this.$array0.data.length);
    $this.$version = $this.$version + 1 | 0;
},
ju_ArrayDeque_removeFirst = $this => {
    let $value;
    $value = $this.$pollFirst();
    if ($value !== null)
        return $value;
    $rt_throw(ju_NoSuchElementException__init_());
},
ju_ArrayDeque_pollFirst = $this => {
    let $result;
    if ($this.$head0 == $this.$tail0)
        return null;
    $result = $this.$array0.data[$this.$head0];
    $this.$array0.data[$this.$head0] = null;
    $this.$head0 = ju_ArrayDeque_modInc($this.$head0, $this.$array0.data.length);
    $this.$version = $this.$version + 1 | 0;
    return $result;
},
ju_ArrayDeque_add = ($this, $e) => {
    $this.$addLast($e);
    return 1;
},
ju_ArrayDeque_remove = $this => {
    return $this.$removeFirst();
},
ju_ArrayDeque_size = $this => {
    return $this.$tail0 >= $this.$head0 ? $this.$tail0 - $this.$head0 | 0 : ($this.$array0.data.length - $this.$head0 | 0) + $this.$tail0 | 0;
},
ju_ArrayDeque_isEmpty = $this => {
    return $this.$head0 != $this.$tail0 ? 0 : 1;
},
ju_ArrayDeque_modInc = ($i, $mod) => {
    let var$3;
    var$3 = $i + 1 | 0;
    if (var$3 == $mod)
        var$3 = 0;
    return var$3;
},
ju_ArrayDeque_ensureCapacity = ($this, $capacity) => {
    let $newArraySize, $newArray, $j, $i, var$6, var$7, var$8;
    if ($capacity < $this.$array0.data.length)
        return;
    $newArraySize = jl_Math_max($this.$array0.data.length * 2 | 0, (($capacity * 3 | 0) / 2 | 0) + 1 | 0);
    if ($newArraySize < 1)
        $newArraySize = 2147483647;
    $newArray = $rt_createArray(jl_Object, $newArraySize);
    $j = 0;
    if ($this.$head0 <= $this.$tail0) {
        $i = $this.$head0;
        while ($i < $this.$tail0) {
            var$6 = $newArray.data;
            var$7 = $j + 1 | 0;
            var$6[$j] = $this.$array0.data[$i];
            $i = $i + 1 | 0;
            $j = var$7;
        }
    } else {
        $i = $this.$head0;
        while ($i < $this.$array0.data.length) {
            var$8 = $newArray.data;
            var$7 = $j + 1 | 0;
            var$8[$j] = $this.$array0.data[$i];
            $i = $i + 1 | 0;
            $j = var$7;
        }
        $i = 0;
        while ($i < $this.$tail0) {
            var$6 = $newArray.data;
            var$7 = $j + 1 | 0;
            var$6[$j] = $this.$array0.data[$i];
            $i = $i + 1 | 0;
            $j = var$7;
        }
    }
    $this.$head0 = 0;
    $this.$tail0 = $j;
    $this.$array0 = $newArray;
},
jur_AbstractCharClass$LazyJavaMirrored = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaMirrored__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaMirrored__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaMirrored();
    jur_AbstractCharClass$LazyJavaMirrored__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaMirrored_computeValue = $this => {
    return jur_AbstractCharClass$LazyJavaMirrored$1__init_0($this);
};
function jur_AbstractCharClass$LazyJavaDigit$1() {
    jur_AbstractCharClass.call(this);
    this.$this$018 = null;
}
let jur_AbstractCharClass$LazyJavaDigit$1__init_ = ($this, $this$0) => {
    $this.$this$018 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaDigit$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaDigit$1();
    jur_AbstractCharClass$LazyJavaDigit$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaDigit$1_contains = ($this, $ch) => {
    return jl_Character_isDigit($ch);
},
jur_AbstractCharClass$LazyJavaISOControl = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaISOControl__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaISOControl__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaISOControl();
    jur_AbstractCharClass$LazyJavaISOControl__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaISOControl_computeValue = $this => {
    return jur_AbstractCharClass$LazyJavaISOControl$1__init_0($this);
},
jl_IllegalStateException = $rt_classWithoutFields(jl_RuntimeException),
jl_IllegalStateException__init_0 = $this => {
    jl_RuntimeException__init_($this);
},
jl_IllegalStateException__init_1 = () => {
    let var_0 = new jl_IllegalStateException();
    jl_IllegalStateException__init_0(var_0);
    return var_0;
},
jl_IllegalStateException__init_ = ($this, $message) => {
    jl_RuntimeException__init_0($this, $message);
},
jl_IllegalStateException__init_2 = var_0 => {
    let var_1 = new jl_IllegalStateException();
    jl_IllegalStateException__init_(var_1, var_0);
    return var_1;
},
owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0 = $rt_classWithoutFields(),
owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0__init_ = var$0 => {
    jl_Object__init_(var$0);
},
owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0__init_0 = () => {
    let var_0 = new owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0();
    owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0__init_(var_0);
    return var_0;
},
owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0_get0 = var$0 => {
    return owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0_get(var$0);
},
owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0_get = var$0 => {
    return cm_SearchWCA__init_0();
};
function cm_CoordCube() {
    let a = this; jl_Object.call(a);
    a.$twist = 0;
    a.$tsym = 0;
    a.$flip = 0;
    a.$fsym = 0;
    a.$slice0 = 0;
    a.$prun = 0;
    a.$twistc = 0;
    a.$flipc = 0;
}
let cm_CoordCube_UDSliceMove = null,
cm_CoordCube_TwistMove = null,
cm_CoordCube_FlipMove = null,
cm_CoordCube_UDSliceConj = null,
cm_CoordCube_UDSliceTwistPrun = null,
cm_CoordCube_UDSliceFlipPrun = null,
cm_CoordCube_TwistFlipPrun = null,
cm_CoordCube_CPermMove = null,
cm_CoordCube_EPermMove = null,
cm_CoordCube_MPermMove = null,
cm_CoordCube_MPermConj = null,
cm_CoordCube_CCombPMove = null,
cm_CoordCube_CCombPConj = null,
cm_CoordCube_MCPermPrun = null,
cm_CoordCube_EPermCCombPPrun = null,
cm_CoordCube_initLevel = 0,
cm_CoordCube_$callClinit = () => {
    cm_CoordCube_$callClinit = $rt_eraseClinit(cm_CoordCube);
    cm_CoordCube__clinit_();
},
cm_CoordCube_init = $fullInit => {
    jl_Object_monitorEnterSync($rt_cls(cm_CoordCube));
    try {
        cm_CoordCube_$callClinit();
        a: {
            if (cm_CoordCube_initLevel != 2) {
                if (cm_CoordCube_initLevel != 1)
                    break a;
                if ($fullInit)
                    break a;
            }
            return;
        }
        if (!cm_CoordCube_initLevel) {
            cm_CubieCube_initPermSym2Raw();
            cm_CoordCube_initCPermMove();
            cm_CoordCube_initEPermMove();
            cm_CoordCube_initMPermMoveConj();
            cm_CoordCube_initCombPMoveConj();
            cm_CubieCube_initFlipSym2Raw();
            cm_CubieCube_initTwistSym2Raw();
            cm_CoordCube_initFlipMove();
            cm_CoordCube_initTwistMove();
            cm_CoordCube_initUDSliceMoveConj();
        }
        cm_CoordCube_initMCPermPrun($fullInit);
        cm_CoordCube_initPermCombPPrun($fullInit);
        cm_CoordCube_initSliceTwistPrun($fullInit);
        cm_CoordCube_initSliceFlipPrun($fullInit);
        cm_CoordCube_initTwistFlipPrun($fullInit);
        cm_CoordCube_initLevel = !$fullInit ? 1 : 2;
    } finally {
        jl_Object_monitorExitSync($rt_cls(cm_CoordCube));
    }
},
cm_CoordCube_setPruning = ($table, $index, $value) => {
    let var$4, var$5;
    cm_CoordCube_$callClinit();
    var$4 = $table.data;
    var$5 = $index >> 3;
    var$4[var$5] = var$4[var$5] ^ $value << ($index << 2);
},
cm_CoordCube_getPruning = ($table, $index) => {
    cm_CoordCube_$callClinit();
    return $table.data[$index >> 3] >> ($index << 2) & 15;
},
cm_CoordCube_initUDSliceMoveConj = () => {
    let $c, $d, $i, $j, $udslice, $k;
    cm_CoordCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    $i = 0;
    while ($i < 495) {
        $c.$setUDSlice($i);
        $j = 0;
        while ($j < 18) {
            cm_CubieCube_EdgeMult($c, cm_CubieCube_moveCube.data[$j], $d);
            cm_CoordCube_UDSliceMove.data[$i].data[$j] = $d.$getUDSlice() & 65535;
            $j = $j + 3 | 0;
        }
        $j = 0;
        while ($j < 16) {
            cm_CubieCube_EdgeConjugate($c, cm_CubieCube_SymMultInv.data[0].data[$j], $d);
            cm_CoordCube_UDSliceConj.data[$i].data[$j >> 1] = $d.$getUDSlice() & 65535;
            $j = $j + 2 | 0;
        }
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 495) {
        $j = 0;
        while ($j < 18) {
            $udslice = cm_CoordCube_UDSliceMove.data[$i].data[$j];
            $k = 1;
            while ($k < 3) {
                $udslice = cm_CoordCube_UDSliceMove.data[$udslice].data[$j];
                cm_CoordCube_UDSliceMove.data[$i].data[$j + $k | 0] = $udslice & 65535;
                $k = $k + 1 | 0;
            }
            $j = $j + 3 | 0;
        }
        $i = $i + 1 | 0;
    }
},
cm_CoordCube_initFlipMove = () => {
    let $c, $d, $i, $j;
    cm_CoordCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    $i = 0;
    while ($i < 336) {
        $c.$setFlip(cm_CubieCube_FlipS2R.data[$i]);
        $j = 0;
        while ($j < 18) {
            cm_CubieCube_EdgeMult($c, cm_CubieCube_moveCube.data[$j], $d);
            cm_CoordCube_FlipMove.data[$i].data[$j] = $d.$getFlipSym() & 65535;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
cm_CoordCube_initTwistMove = () => {
    let $c, $d, $i, $j;
    cm_CoordCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    $i = 0;
    while ($i < 324) {
        $c.$setTwist(cm_CubieCube_TwistS2R.data[$i]);
        $j = 0;
        while ($j < 18) {
            cm_CubieCube_CornMult($c, cm_CubieCube_moveCube.data[$j], $d);
            cm_CoordCube_TwistMove.data[$i].data[$j] = $d.$getTwistSym() & 65535;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
cm_CoordCube_initCPermMove = () => {
    let $c, $d, $i, $j, var$5;
    cm_CoordCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    $i = 0;
    while ($i < 2768) {
        $c.$setCPerm(cm_CubieCube_EPermS2R.data[$i]);
        $j = 0;
        while ($j < 10) {
            var$5 = cm_CubieCube_moveCube.data;
            cm_Util_$callClinit();
            cm_CubieCube_CornMult($c, var$5[cm_Util_ud2std.data[$j]], $d);
            cm_CoordCube_CPermMove.data[$i].data[$j] = $d.$getCPermSym() & 65535;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
cm_CoordCube_initEPermMove = () => {
    let $c, $d, $i, $j, var$5;
    cm_CoordCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    $i = 0;
    while ($i < 2768) {
        $c.$setEPerm(cm_CubieCube_EPermS2R.data[$i]);
        $j = 0;
        while ($j < 10) {
            var$5 = cm_CubieCube_moveCube.data;
            cm_Util_$callClinit();
            cm_CubieCube_EdgeMult($c, var$5[cm_Util_ud2std.data[$j]], $d);
            cm_CoordCube_EPermMove.data[$i].data[$j] = $d.$getEPermSym() & 65535;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
cm_CoordCube_initMPermMoveConj = () => {
    let $c, $d, $i, $j, var$5;
    cm_CoordCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    $i = 0;
    while ($i < 24) {
        $c.$setMPerm($i);
        $j = 0;
        while ($j < 10) {
            var$5 = cm_CubieCube_moveCube.data;
            cm_Util_$callClinit();
            cm_CubieCube_EdgeMult($c, var$5[cm_Util_ud2std.data[$j]], $d);
            cm_CoordCube_MPermMove.data[$i].data[$j] = $d.$getMPerm() & 65535;
            $j = $j + 1 | 0;
        }
        $j = 0;
        while ($j < 16) {
            cm_CubieCube_EdgeConjugate($c, cm_CubieCube_SymMultInv.data[0].data[$j], $d);
            cm_CoordCube_MPermConj.data[$i].data[$j] = $d.$getMPerm() & 65535;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
cm_CoordCube_initCombPMoveConj = () => {
    let $c, $d, $i, $j, var$5;
    cm_CoordCube_$callClinit();
    $c = cm_CubieCube__init_();
    $d = cm_CubieCube__init_();
    cm_CoordCube_CCombPMove = $rt_createCharMultiArray([10, 140]);
    $i = 0;
    while ($i < 140) {
        $c.$setCComb($i % 70 | 0);
        $j = 0;
        while ($j < 10) {
            var$5 = cm_CubieCube_moveCube.data;
            cm_Util_$callClinit();
            cm_CubieCube_CornMult($c, var$5[cm_Util_ud2std.data[$j]], $d);
            cm_CoordCube_CCombPMove.data[$i].data[$j] = ($d.$getCComb() + (70 * (165 >> $j & 1 ^ ($i / 70 | 0)) | 0) | 0) & 65535;
            $j = $j + 1 | 0;
        }
        $j = 0;
        while ($j < 16) {
            cm_CubieCube_CornConjugate($c, cm_CubieCube_SymMultInv.data[0].data[$j], $d);
            cm_CoordCube_CCombPConj.data[$i].data[$j] = ($d.$getCComb() + (70 * ($i / 70 | 0) | 0) | 0) & 65535;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
},
cm_CoordCube_hasZero = $val => {
    cm_CoordCube_$callClinit();
    return !(($val - 286331153 | 0) & ($val ^ (-1)) & (-2004318072)) ? 0 : 1;
},
cm_CoordCube_initRawSymPrun = ($PrunTable, $RawMove, $RawConj, $SymMove, $SymState, $PrunFlag, $fullInit) => {
    let $SYM_SHIFT, $SYM_E2C_MAGIC, $IS_PHASE2, $INV_DEPTH, $SEARCH_DEPTH, $SEARCH_DEPTH_0, $SYM_MASK, $ISTFP, $N_RAW, var$17, $N_SIZE, $N_MOVES, $NEXT_AXIS_MAGIC, $check, $i, var$23, $mask, var$25, $val, var$27, $inv, $select, $selArrMask, $xorVal, $raw, $sym, $flip, $fsym, $m, $symx, $rawx, var$39, $idx, $prun, var$42, $j, $symState;
    cm_CoordCube_$callClinit();
    $SYM_SHIFT = $PrunFlag & 15;
    $SYM_E2C_MAGIC = ($PrunFlag >> 4 & 1) != 1 ? 0 : 14540032;
    $IS_PHASE2 = ($PrunFlag >> 5 & 1) != 1 ? 0 : 1;
    $INV_DEPTH = $PrunFlag >> 8 & 15;
    $SEARCH_DEPTH = $PrunFlag >> 12 & 15;
    $SEARCH_DEPTH_0 = $PrunFlag >> 16 & 15;
    if ($fullInit)
        $SEARCH_DEPTH_0 = $SEARCH_DEPTH;
    $SYM_MASK = (1 << $SYM_SHIFT) - 1 | 0;
    $ISTFP = $RawMove !== null ? 0 : 1;
    $N_RAW = $ISTFP ? 2048 : $RawMove.data.length;
    var$17 = $SymMove.data;
    $N_SIZE = $rt_imul($N_RAW, var$17.length);
    $N_MOVES = !$IS_PHASE2 ? 18 : 10;
    $NEXT_AXIS_MAGIC = $N_MOVES != 10 ? 599186 : 66;
    $check = cm_CoordCube_getPruning($PrunTable, $N_SIZE) - 1 | 0;
    if ($check == (-1)) {
        $i = 0;
        while ($i < (($N_SIZE / 8 | 0) + 1 | 0)) {
            $PrunTable.data[$i] = 286331153;
            $i = $i + 1 | 0;
        }
        cm_CoordCube_setPruning($PrunTable, 0, 1);
        $check = 0;
    }
    while ($check < $SEARCH_DEPTH_0) {
        var$23 = $check + 1 | 0;
        $mask = $rt_imul(var$23, 286331153) ^ (-1);
        $i = 0;
        while (true) {
            var$25 = $PrunTable.data;
            if ($i >= var$25.length)
                break;
            $val = var$25[$i] ^ $mask;
            var$27 = $val & $val >> 1;
            var$25[$i] = var$25[$i] + (var$27 & var$27 >> 2 & 286331153) | 0;
            $i = $i + 1 | 0;
        }
        $inv = $check <= $INV_DEPTH ? 0 : 1;
        $select = !$inv ? $check : $check + 2 | 0;
        $selArrMask = $rt_imul($select, 286331153);
        if (!$inv)
            $check = $check + 2 | 0;
        $xorVal = var$23 ^ (var$23 + 1 | 0);
        $val = 0;
        $i = 0;
        while ($i < $N_SIZE) {
            a: {
                if (!($i & 7)) {
                    $val = var$25[$i >> 3];
                    if (!cm_CoordCube_hasZero($val ^ $selArrMask)) {
                        $i = $i + 7 | 0;
                        break a;
                    }
                }
                if (($val & 15) == $select) {
                    $raw = $i % $N_RAW | 0;
                    $sym = $i / $N_RAW | 0;
                    $flip = 0;
                    $fsym = 0;
                    if ($ISTFP) {
                        cm_CubieCube_$callClinit();
                        var$27 = cm_CubieCube_FlipR2S.data[$raw];
                        $fsym = var$27 & 7;
                        $flip = var$27 >> 3;
                    }
                    $m = 0;
                    while ($m < $N_MOVES) {
                        $symx = var$17[$sym].data[$m];
                        if (!$ISTFP)
                            $rawx = $RawConj.data[$RawMove.data[$raw].data[$m]].data[$symx & $SYM_MASK];
                        else {
                            cm_CubieCube_$callClinit();
                            $rawx = cm_CubieCube_FlipS2RF.data[cm_CoordCube_FlipMove.data[$flip].data[cm_CubieCube_Sym8Move.data[$m << 3 | $fsym]] ^ $fsym ^ $symx & $SYM_MASK];
                        }
                        var$27 = $symx >> $SYM_SHIFT;
                        var$39 = $rt_imul(var$27, $N_RAW);
                        $idx = var$39 + $rawx | 0;
                        $prun = cm_CoordCube_getPruning($PrunTable, $idx);
                        if ($prun == $check) {
                            if ($inv) {
                                cm_CoordCube_setPruning($PrunTable, $i, $xorVal);
                                break a;
                            }
                            var$42 = $SymState.data;
                            cm_CoordCube_setPruning($PrunTable, $idx, $xorVal);
                            $j = 1;
                            $symState = var$42[var$27];
                            while (true) {
                                $symState = $symState >> 1;
                                if (!$symState)
                                    break;
                                if (($symState & 1) == 1) {
                                    if ($ISTFP) {
                                        cm_CubieCube_$callClinit();
                                        var$27 = var$39 + cm_CubieCube_FlipS2RF.data[cm_CubieCube_FlipR2S.data[$rawx] ^ $j] | 0;
                                    } else
                                        var$27 = var$39 + $RawConj.data[$rawx].data[$j ^ $SYM_E2C_MAGIC >> ($j << 1) & 3] | 0;
                                    if (cm_CoordCube_getPruning($PrunTable, var$27) == $check)
                                        cm_CoordCube_setPruning($PrunTable, var$27, $xorVal);
                                }
                                $j = $j + 1 | 0;
                            }
                        } else if ($prun < (var$23 - 1 | 0))
                            $m = $m + ($NEXT_AXIS_MAGIC >> $m & 3) | 0;
                        $m = $m + 1 | 0;
                    }
                }
            }
            $i = $i + 1 | 0;
            $val = $val >> 4;
        }
        $check = var$23;
    }
},
cm_CoordCube_initTwistFlipPrun = $fullInit => {
    let var$2, var$3, var$4, var$5;
    cm_CoordCube_$callClinit();
    var$2 = cm_CoordCube_TwistFlipPrun;
    var$3 = null;
    var$4 = null;
    var$5 = cm_CoordCube_TwistMove;
    cm_CubieCube_$callClinit();
    cm_CoordCube_initRawSymPrun(var$2, var$3, var$4, var$5, cm_CubieCube_SymStateTwist, 103939, $fullInit);
},
cm_CoordCube_initSliceTwistPrun = $fullInit => {
    let var$2, var$3, var$4, var$5;
    cm_CoordCube_$callClinit();
    var$2 = cm_CoordCube_UDSliceTwistPrun;
    var$3 = cm_CoordCube_UDSliceMove;
    var$4 = cm_CoordCube_UDSliceConj;
    var$5 = cm_CoordCube_TwistMove;
    cm_CubieCube_$callClinit();
    cm_CoordCube_initRawSymPrun(var$2, var$3, var$4, var$5, cm_CubieCube_SymStateTwist, 431619, $fullInit);
},
cm_CoordCube_initSliceFlipPrun = $fullInit => {
    let var$2, var$3, var$4, var$5;
    cm_CoordCube_$callClinit();
    var$2 = cm_CoordCube_UDSliceFlipPrun;
    var$3 = cm_CoordCube_UDSliceMove;
    var$4 = cm_CoordCube_UDSliceConj;
    var$5 = cm_CoordCube_FlipMove;
    cm_CubieCube_$callClinit();
    cm_CoordCube_initRawSymPrun(var$2, var$3, var$4, var$5, cm_CubieCube_SymStateFlip, 431619, $fullInit);
},
cm_CoordCube_initMCPermPrun = $fullInit => {
    let var$2, var$3, var$4, var$5;
    cm_CoordCube_$callClinit();
    var$2 = cm_CoordCube_MCPermPrun;
    var$3 = cm_CoordCube_MPermMove;
    var$4 = cm_CoordCube_MPermConj;
    var$5 = cm_CoordCube_CPermMove;
    cm_CubieCube_$callClinit();
    cm_CoordCube_initRawSymPrun(var$2, var$3, var$4, var$5, cm_CubieCube_SymStatePerm, 584244, $fullInit);
},
cm_CoordCube_initPermCombPPrun = $fullInit => {
    let var$2, var$3, var$4, var$5;
    cm_CoordCube_$callClinit();
    var$2 = cm_CoordCube_EPermCCombPPrun;
    var$3 = cm_CoordCube_CCombPMove;
    var$4 = cm_CoordCube_CCombPConj;
    var$5 = cm_CoordCube_EPermMove;
    cm_CubieCube_$callClinit();
    cm_CoordCube_initRawSymPrun(var$2, var$3, var$4, var$5, cm_CubieCube_SymStatePerm, 514084, $fullInit);
},
cm_CoordCube__init_0 = $this => {
    cm_CoordCube_$callClinit();
    jl_Object__init_($this);
},
cm_CoordCube__init_ = () => {
    let var_0 = new cm_CoordCube();
    cm_CoordCube__init_0(var_0);
    return var_0;
},
cm_CoordCube_calcPruning = ($this, $isPhase1) => {
    let var$2, var$3, var$4, var$5;
    cm_CoordCube_$callClinit();
    var$2 = cm_CoordCube_UDSliceTwistPrun;
    var$3 = ($this.$twist * 495 | 0) + cm_CoordCube_UDSliceConj.data[$this.$slice0].data[$this.$tsym] | 0;
    var$3 = cm_CoordCube_getPruning(var$2, var$3);
    var$2 = cm_CoordCube_UDSliceFlipPrun;
    var$4 = ($this.$flip * 495 | 0) + cm_CoordCube_UDSliceConj.data[$this.$slice0].data[$this.$fsym] | 0;
    var$4 = cm_CoordCube_getPruning(var$2, var$4);
    var$4 = jl_Math_max(var$3, var$4);
    var$2 = cm_CoordCube_TwistFlipPrun;
    var$5 = $this.$twistc >> 3 << 11;
    cm_CubieCube_$callClinit();
    var$3 = var$5 | cm_CubieCube_FlipS2RF.data[$this.$flipc ^ $this.$twistc & 7];
    var$3 = cm_CoordCube_getPruning(var$2, var$3);
    var$2 = cm_CoordCube_TwistFlipPrun;
    var$5 = $this.$twist << 11 | cm_CubieCube_FlipS2RF.data[$this.$flip << 3 | $this.$fsym ^ $this.$tsym];
    var$5 = cm_CoordCube_getPruning(var$2, var$5);
    var$3 = jl_Math_max(var$3, var$5);
    $this.$prun = jl_Math_max(var$4, var$3);
},
cm_CoordCube_setWithPrun = ($this, $cc, $depth) => {
    let var$3, var$4, var$5, var$6, var$7, $pc;
    $this.$twist = $cc.$getTwistSym();
    $this.$flip = $cc.$getFlipSym();
    $this.$tsym = $this.$twist & 7;
    $this.$twist = $this.$twist >> 3;
    cm_CoordCube_$callClinit();
    $this.$prun = cm_CoordCube_getPruning(cm_CoordCube_TwistFlipPrun, $this.$twist << 11 | cm_CubieCube_FlipS2RF.data[$this.$flip ^ $this.$tsym]);
    if ($this.$prun > $depth)
        return 0;
    $this.$fsym = $this.$flip & 7;
    $this.$flip = $this.$flip >> 3;
    $this.$slice0 = $cc.$getUDSlice();
    var$3 = $this.$prun;
    var$4 = cm_CoordCube_UDSliceTwistPrun;
    var$5 = ($this.$twist * 495 | 0) + cm_CoordCube_UDSliceConj.data[$this.$slice0].data[$this.$tsym] | 0;
    var$5 = cm_CoordCube_getPruning(var$4, var$5);
    var$6 = cm_CoordCube_UDSliceFlipPrun;
    var$7 = ($this.$flip * 495 | 0) + cm_CoordCube_UDSliceConj.data[$this.$slice0].data[$this.$fsym] | 0;
    var$7 = cm_CoordCube_getPruning(var$6, var$7);
    $this.$prun = jl_Math_max(var$3, jl_Math_max(var$5, var$7));
    if ($this.$prun > $depth)
        return 0;
    $pc = cm_CubieCube__init_();
    cm_CubieCube_CornConjugate($cc, 1, $pc);
    cm_CubieCube_EdgeConjugate($cc, 1, $pc);
    $this.$twistc = $pc.$getTwistSym();
    $this.$flipc = $pc.$getFlipSym();
    var$5 = $this.$prun;
    var$6 = cm_CoordCube_TwistFlipPrun;
    var$7 = $this.$twistc >> 3 << 11 | cm_CubieCube_FlipS2RF.data[$this.$flipc ^ $this.$twistc & 7];
    var$7 = cm_CoordCube_getPruning(var$6, var$7);
    $this.$prun = jl_Math_max(var$5, var$7);
    return $this.$prun > $depth ? 0 : 1;
},
cm_CoordCube_doMovePrun = ($this, $cc, $m, $isPhase1) => {
    let var$4, var$5, var$6, var$7;
    cm_CoordCube_$callClinit();
    $this.$slice0 = cm_CoordCube_UDSliceMove.data[$cc.$slice0].data[$m];
    var$4 = cm_CoordCube_FlipMove.data[$cc.$flip].data;
    cm_CubieCube_$callClinit();
    var$5 = cm_CubieCube_Sym8Move.data;
    var$6 = $m << 3;
    $this.$flip = var$4[var$5[var$6 | $cc.$fsym]];
    $this.$fsym = $this.$flip & 7 ^ $cc.$fsym;
    $this.$flip = $this.$flip >> 3;
    $this.$twist = cm_CoordCube_TwistMove.data[$cc.$twist].data[cm_CubieCube_Sym8Move.data[var$6 | $cc.$tsym]];
    $this.$tsym = $this.$twist & 7 ^ $cc.$tsym;
    $this.$twist = $this.$twist >> 3;
    var$5 = cm_CoordCube_UDSliceTwistPrun;
    var$6 = ($this.$twist * 495 | 0) + cm_CoordCube_UDSliceConj.data[$this.$slice0].data[$this.$tsym] | 0;
    var$6 = cm_CoordCube_getPruning(var$5, var$6);
    var$5 = cm_CoordCube_UDSliceFlipPrun;
    var$7 = ($this.$flip * 495 | 0) + cm_CoordCube_UDSliceConj.data[$this.$slice0].data[$this.$fsym] | 0;
    var$7 = cm_CoordCube_getPruning(var$5, var$7);
    var$7 = jl_Math_max(var$6, var$7);
    var$4 = cm_CoordCube_TwistFlipPrun;
    var$6 = $this.$twist << 11 | cm_CubieCube_FlipS2RF.data[$this.$flip << 3 | $this.$fsym ^ $this.$tsym];
    var$6 = cm_CoordCube_getPruning(var$4, var$6);
    $this.$prun = jl_Math_max(var$7, var$6);
    return $this.$prun;
},
cm_CoordCube_doMovePrunConj = ($this, $cc, $m) => {
    let var$3, var$4, var$5;
    cm_CubieCube_$callClinit();
    var$3 = cm_CubieCube_SymMove.data[3].data[$m];
    cm_CoordCube_$callClinit();
    var$4 = cm_CoordCube_FlipMove.data[$cc.$flipc >> 3].data;
    var$5 = cm_CubieCube_Sym8Move.data;
    var$3 = var$3 << 3;
    $this.$flipc = var$4[var$5[var$3 | $cc.$flipc & 7]] ^ $cc.$flipc & 7;
    $this.$twistc = cm_CoordCube_TwistMove.data[$cc.$twistc >> 3].data[cm_CubieCube_Sym8Move.data[var$3 | $cc.$twistc & 7]] ^ $cc.$twistc & 7;
    return cm_CoordCube_getPruning(cm_CoordCube_TwistFlipPrun, $this.$twistc >> 3 << 11 | cm_CubieCube_FlipS2RF.data[$this.$flipc ^ $this.$twistc & 7]);
},
cm_CoordCube__clinit_ = () => {
    cm_CoordCube_UDSliceMove = $rt_createCharMultiArray([18, 495]);
    cm_CoordCube_TwistMove = $rt_createCharMultiArray([18, 324]);
    cm_CoordCube_FlipMove = $rt_createCharMultiArray([18, 336]);
    cm_CoordCube_UDSliceConj = $rt_createCharMultiArray([8, 495]);
    cm_CoordCube_UDSliceTwistPrun = $rt_createIntArray(20048);
    cm_CoordCube_UDSliceFlipPrun = $rt_createIntArray(20791);
    cm_CoordCube_TwistFlipPrun = $rt_createIntArray(82945);
    cm_CoordCube_CPermMove = $rt_createCharMultiArray([10, 2768]);
    cm_CoordCube_EPermMove = $rt_createCharMultiArray([10, 2768]);
    cm_CoordCube_MPermMove = $rt_createCharMultiArray([10, 24]);
    cm_CoordCube_MPermConj = $rt_createCharMultiArray([16, 24]);
    cm_CoordCube_CCombPConj = $rt_createCharMultiArray([16, 140]);
    cm_CoordCube_MCPermPrun = $rt_createIntArray(8305);
    cm_CoordCube_EPermCCombPPrun = $rt_createIntArray(48441);
    cm_CoordCube_initLevel = 0;
};
function jur_HighSurrogateCharSet() {
    jur_JointSet.call(this);
    this.$high = 0;
}
let jur_HighSurrogateCharSet__init_ = ($this, $high) => {
    jur_JointSet__init_($this);
    $this.$high = $high;
},
jur_HighSurrogateCharSet__init_0 = var_0 => {
    let var_1 = new jur_HighSurrogateCharSet();
    jur_HighSurrogateCharSet__init_(var_1, var_0);
    return var_1;
},
jur_HighSurrogateCharSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
},
jur_HighSurrogateCharSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $strLength, var$5, var$6, $high, $low;
    $strLength = $matchResult.$getRightBound();
    var$5 = $stringIndex + 1 | 0;
    var$6 = $rt_compare(var$5, $strLength);
    if (var$6 > 0) {
        $matchResult.$hitEnd = 1;
        return (-1);
    }
    $high = $testString.$charAt($stringIndex);
    if (var$6 < 0) {
        $low = $testString.$charAt(var$5);
        if (jl_Character_isLowSurrogate($low))
            return (-1);
    }
    if ($this.$high != $high)
        return (-1);
    return $this.$next3.$matches(var$5, $testString, $matchResult);
},
jur_HighSurrogateCharSet_find = ($this, $strIndex, $testString, $matchResult) => {
    let $testStr, $strLength, var$6;
    if (!($testString instanceof jl_String))
        return jur_AbstractSet_find($this, $strIndex, $testString, $matchResult);
    $testStr = $testString;
    $strLength = $matchResult.$getRightBound();
    while (true) {
        if ($strIndex >= $strLength)
            return (-1);
        var$6 = $testStr.$indexOf2($this.$high, $strIndex);
        if (var$6 < 0)
            return (-1);
        $strIndex = var$6 + 1 | 0;
        if ($strIndex < $strLength && jl_Character_isLowSurrogate($testStr.$charAt($strIndex))) {
            $strIndex = var$6 + 2 | 0;
            continue;
        }
        if ($this.$next3.$matches($strIndex, $testString, $matchResult) >= 0)
            break;
    }
    return var$6;
},
jur_HighSurrogateCharSet_findBack = ($this, $strIndex, $lastIndex, $testString, $matchResult) => {
    let $testStr, $strLength, var$7, var$8;
    if (!($testString instanceof jl_String))
        return jur_AbstractSet_findBack($this, $strIndex, $lastIndex, $testString, $matchResult);
    $testStr = $testString;
    $strLength = $matchResult.$getRightBound();
    a: {
        while (true) {
            if ($lastIndex < $strIndex)
                return (-1);
            var$7 = $testStr.$lastIndexOf1($this.$high, $lastIndex);
            if (var$7 < 0)
                break a;
            if (var$7 < $strIndex)
                break a;
            var$8 = var$7 + 1 | 0;
            if (var$8 < $strLength && jl_Character_isLowSurrogate($testStr.$charAt(var$8))) {
                $lastIndex = var$7 + (-1) | 0;
                continue;
            }
            if ($this.$next3.$matches(var$8, $testString, $matchResult) >= 0)
                break;
            $lastIndex = var$7 + (-1) | 0;
        }
        return var$7;
    }
    return (-1);
},
jur_HighSurrogateCharSet_first = ($this, $set) => {
    if ($set instanceof jur_CharSet)
        return 0;
    if ($set instanceof jur_RangeSet)
        return 0;
    if ($set instanceof jur_SupplRangeSet)
        return 0;
    if ($set instanceof jur_SupplCharSet)
        return 0;
    if ($set instanceof jur_LowSurrogateCharSet)
        return 0;
    if (!($set instanceof jur_HighSurrogateCharSet))
        return 1;
    return $set.$high != $this.$high ? 0 : 1;
},
jur_HighSurrogateCharSet_hasConsumed = ($this, $matchResult) => {
    return 1;
},
jur_ReluctantCompositeQuantifierSet = $rt_classWithoutFields(jur_CompositeQuantifierSet),
jur_ReluctantCompositeQuantifierSet__init_ = ($this, $quant, $innerSet, $next, $type) => {
    jur_CompositeQuantifierSet__init_($this, $quant, $innerSet, $next, $type);
},
jur_ReluctantCompositeQuantifierSet__init_0 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new jur_ReluctantCompositeQuantifierSet();
    jur_ReluctantCompositeQuantifierSet__init_(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
jur_ReluctantCompositeQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $min, $max, $i, var$7, var$8;
    $min = $this.$quantifier.$min();
    $max = $this.$quantifier.$max();
    $i = 0;
    while (true) {
        if ($i >= $min) {
            a: {
                while (true) {
                    var$7 = $this.$next3.$matches($stringIndex, $testString, $matchResult);
                    if (var$7 >= 0)
                        break;
                    if (($stringIndex + $this.$leaf.$charCount() | 0) <= $matchResult.$getRightBound()) {
                        var$7 = $this.$leaf.$accepts($stringIndex, $testString);
                        $stringIndex = $stringIndex + var$7 | 0;
                        $i = $i + 1 | 0;
                    }
                    if (var$7 < 1)
                        break a;
                    if ($i > $max)
                        break a;
                }
                return var$7;
            }
            return (-1);
        }
        if (($stringIndex + $this.$leaf.$charCount() | 0) > $matchResult.$getRightBound()) {
            $matchResult.$hitEnd = 1;
            return (-1);
        }
        var$8 = $this.$leaf.$accepts($stringIndex, $testString);
        if (var$8 < 1)
            break;
        $stringIndex = $stringIndex + var$8 | 0;
        $i = $i + 1 | 0;
    }
    return (-1);
},
jl_NullPointerException = $rt_classWithoutFields(jl_RuntimeException),
jl_NullPointerException__init_1 = ($this, $message) => {
    jl_RuntimeException__init_0($this, $message);
},
jl_NullPointerException__init_ = var_0 => {
    let var_1 = new jl_NullPointerException();
    jl_NullPointerException__init_1(var_1, var_0);
    return var_1;
},
jl_NullPointerException__init_0 = $this => {
    jl_RuntimeException__init_($this);
},
jl_NullPointerException__init_2 = () => {
    let var_0 = new jl_NullPointerException();
    jl_NullPointerException__init_0(var_0);
    return var_0;
},
jur_SOLSet = $rt_classWithoutFields(jur_AbstractSet),
jur_SOLSet__init_ = $this => {
    jur_AbstractSet__init_($this);
},
jur_SOLSet__init_0 = () => {
    let var_0 = new jur_SOLSet();
    jur_SOLSet__init_(var_0);
    return var_0;
},
jur_SOLSet_matches = ($this, $strIndex, $testString, $matchResult) => {
    if ($strIndex && !($matchResult.$hasAnchoringBounds() && $strIndex == $matchResult.$getLeftBound()))
        return (-1);
    return $this.$next3.$matches($strIndex, $testString, $matchResult);
},
jur_SOLSet_hasConsumed = ($this, $matchResult) => {
    return 0;
};
function otpp_AsyncCallbackWrapper() {
    jl_Object.call(this);
    this.$realAsyncCallback = null;
}
let otpp_AsyncCallbackWrapper__init_ = ($this, $realAsyncCallback) => {
    jl_Object__init_($this);
    $this.$realAsyncCallback = $realAsyncCallback;
},
otpp_AsyncCallbackWrapper__init_0 = var_0 => {
    let var_1 = new otpp_AsyncCallbackWrapper();
    otpp_AsyncCallbackWrapper__init_(var_1, var_0);
    return var_1;
},
otpp_AsyncCallbackWrapper_create = $realAsyncCallback => {
    return otpp_AsyncCallbackWrapper__init_0($realAsyncCallback);
},
otpp_AsyncCallbackWrapper_complete = ($this, $result) => {
    $this.$realAsyncCallback.$complete($result);
},
otpp_AsyncCallbackWrapper_error = ($this, $e) => {
    $this.$realAsyncCallback.$error($e);
};
function jur_AbstractCharClass$LazyJavaSpaceChar$1() {
    jur_AbstractCharClass.call(this);
    this.$this$034 = null;
}
let jur_AbstractCharClass$LazyJavaSpaceChar$1__init_ = ($this, $this$0) => {
    $this.$this$034 = $this$0;
    jur_AbstractCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaSpaceChar$1__init_0 = var_0 => {
    let var_1 = new jur_AbstractCharClass$LazyJavaSpaceChar$1();
    jur_AbstractCharClass$LazyJavaSpaceChar$1__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaSpaceChar$1_contains = ($this, $ch) => {
    return jl_Character_isSpaceChar($ch);
},
otr_EventQueue$Event = $rt_classWithoutFields(0);
function jl_Object$Monitor() {
    let a = this; jl_Object.call(a);
    a.$enteringThreads = null;
    a.$notifyListeners = null;
    a.$owner = null;
    a.$count = 0;
}
let jl_Object$Monitor__init_ = $this => {
    jl_Object__init_($this);
    $this.$owner = jl_Thread_currentThread();
},
jl_Object$Monitor__init_0 = () => {
    let var_0 = new jl_Object$Monitor();
    jl_Object$Monitor__init_(var_0);
    return var_0;
},
jl_ThreadInterruptHandler = $rt_classWithoutFields(0),
jlr_ReferenceQueue$RemoveCallback = $rt_classWithoutFields();
function ju_LinkedHashMapEntrySet() {
    let a = this; ju_AbstractSet.call(a);
    a.$base0 = null;
    a.$reversed = 0;
}
let ju_LinkedHashMapEntrySet__init_ = ($this, $base, $reversed) => {
    ju_AbstractSet__init_($this);
    $this.$base0 = $base;
    $this.$reversed = $reversed;
},
ju_LinkedHashMapEntrySet__init_0 = (var_0, var_1) => {
    let var_2 = new ju_LinkedHashMapEntrySet();
    ju_LinkedHashMapEntrySet__init_(var_2, var_0, var_1);
    return var_2;
},
ju_LinkedHashMapEntrySet_iterator = $this => {
    return ju_LinkedHashMapIterator$EntryIterator__init_0($this.$base0, $this.$reversed);
},
jl_Math = $rt_classWithoutFields(),
jl_Math_sqrt = var$1 => {
    return Math.sqrt(var$1);
},
jl_Math_random = () => {
    return jl_Math_randomImpl();
},
jl_Math_randomImpl = () => {
    return Math.random();
},
jl_Math_min = ($a, $b) => {
    if ($a < $b)
        $b = $a;
    return $b;
},
jl_Math_max = ($a, $b) => {
    if ($a > $b)
        $b = $a;
    return $b;
},
jl_Math_min0 = ($a, $b) => {
    if (Long_lt($a, $b))
        $b = $a;
    return $b;
},
jl_Math_abs = $n => {
    if ($n < 0)
        $n =  -$n | 0;
    return $n;
},
cm_Tools = $rt_classWithoutFields(),
cm_Tools_gen = null,
cm_Tools_STATE_RANDOM = null,
cm_Tools_STATE_SOLVED = null,
cm_Tools_$callClinit = () => {
    cm_Tools_$callClinit = $rt_eraseClinit(cm_Tools);
    cm_Tools__clinit_();
},
cm_Tools_randomCube = $gen => {
    cm_Tools_$callClinit();
    return cm_Tools_randomState(cm_Tools_STATE_RANDOM, cm_Tools_STATE_RANDOM, cm_Tools_STATE_RANDOM, cm_Tools_STATE_RANDOM, $gen);
},
cm_Tools_resolveOri = ($arr, $base) => {
    let $sum, $idx, $lastUnknown, $i, var$7, var$8, var$9;
    cm_Tools_$callClinit();
    $sum = 0;
    $idx = 0;
    $lastUnknown = (-1);
    $i = 0;
    while (true) {
        var$7 = $arr.data;
        var$8 = var$7.length;
        if ($i >= var$8)
            break;
        if (var$7[$i] == (-1)) {
            var$7[$i] = cm_Tools_gen.$nextInt($base) << 24 >> 24;
            $lastUnknown = $i;
        }
        $sum = $sum + var$7[$i] | 0;
        $i = $i + 1 | 0;
    }
    if (($sum % $base | 0) && $lastUnknown != (-1))
        var$7[$lastUnknown] = (((30 + var$7[$lastUnknown] | 0) - $sum | 0) % $base | 0) << 24 >> 24;
    $i = 0;
    while ($i < (var$8 - 1 | 0)) {
        var$9 = $rt_imul($idx, $base);
        $idx = var$9 + var$7[$i] | 0;
        $i = $i + 1 | 0;
    }
    return $idx;
},
cm_Tools_countUnknown = $arr => {
    let $cnt, $i, var$4;
    cm_Tools_$callClinit();
    if ($arr === cm_Tools_STATE_SOLVED)
        return 0;
    $cnt = 0;
    $i = 0;
    while (true) {
        var$4 = $arr.data;
        if ($i >= var$4.length)
            break;
        if (var$4[$i] == (-1))
            $cnt = $cnt + 1 | 0;
        $i = $i + 1 | 0;
    }
    return $cnt;
},
cm_Tools_resolvePerm = ($arr, $cntU, $parity) => {
    let $val, var$5, $i, var$7, var$8, $idx, var$10, var$11, $j, $temp, $last, var$15, $p;
    cm_Tools_$callClinit();
    if ($arr === cm_Tools_STATE_SOLVED)
        return 0;
    if ($arr === cm_Tools_STATE_RANDOM) {
        if ($parity == (-1))
            $parity = cm_Tools_gen.$nextInt(2);
        return $parity;
    }
    $val = $rt_createByteArray(12);
    var$5 = $val.data;
    var$5[0] = 0;
    var$5[1] = 1;
    var$5[2] = 2;
    var$5[3] = 3;
    var$5[4] = 4;
    var$5[5] = 5;
    var$5[6] = 6;
    var$5[7] = 7;
    var$5[8] = 8;
    var$5[9] = 9;
    var$5[10] = 10;
    var$5[11] = 11;
    $i = 0;
    while (true) {
        var$7 = $arr.data;
        var$8 = var$7.length;
        if ($i >= var$8)
            break;
        if (var$7[$i] != (-1))
            var$5[var$7[$i]] = (-1);
        $i = $i + 1 | 0;
    }
    $idx = 0;
    $i = 0;
    while ($i < var$8) {
        if (var$5[$i] != (-1)) {
            var$10 = cm_Tools_gen;
            var$11 = $idx + 1 | 0;
            $j = var$10.$nextInt(var$11);
            $temp = var$5[$i];
            var$5[$idx] = var$5[$j];
            var$5[$j] = $temp;
            $idx = var$11;
        }
        $i = $i + 1 | 0;
    }
    $last = (-1);
    var$15 = 0;
    while (var$15 < var$8 && $cntU > 0) {
        if (var$7[var$15] == (-1)) {
            if ($cntU == 2)
                $last = var$15;
            $cntU = $cntU + (-1) | 0;
            var$7[var$15] = var$5[$cntU];
        }
        var$15 = var$15 + 1 | 0;
    }
    $p = cm_Util_getNParity(cm_Tools_getNPerm($arr, var$8), var$8);
    if ($p == (1 - $parity | 0) && $last != (-1)) {
        var$11 = var$15 - 1 | 0;
        $temp = var$7[var$11];
        var$7[var$11] = var$7[$last];
        var$7[$last] = $temp;
    }
    return $p;
},
cm_Tools_getNPerm = ($arr, $n) => {
    let $idx, $i, $i_0, $j, var$7;
    cm_Tools_$callClinit();
    $idx = 0;
    $i = 0;
    while ($i < $n) {
        $idx = $rt_imul($idx, $n - $i | 0);
        $i_0 = $i + 1 | 0;
        $j = $i_0;
        while ($j < $n) {
            var$7 = $arr.data;
            if (var$7[$j] < var$7[$i])
                $idx = $idx + 1 | 0;
            $j = $j + 1 | 0;
        }
        $i = $i_0;
    }
    return $idx;
},
cm_Tools_randomState = ($cp, $co, $ep, $eo, $gen) => {
    let $cntUE, $cntUC, $epVal, $parity, $cpVal, var$11, var$12;
    cm_Tools_$callClinit();
    $cntUE = $ep !== cm_Tools_STATE_RANDOM ? cm_Tools_countUnknown($ep) : 12;
    $cntUC = $cp !== cm_Tools_STATE_RANDOM ? cm_Tools_countUnknown($cp) : 8;
    if ($cntUE < 2) {
        if ($ep === cm_Tools_STATE_SOLVED) {
            $epVal = 0;
            $parity = $epVal;
        } else {
            $parity = cm_Tools_resolvePerm($ep, $cntUE, (-1));
            $epVal = cm_Tools_getNPerm($ep, 12);
        }
        if ($cp === cm_Tools_STATE_SOLVED)
            $cpVal = 0;
        else if ($cp !== cm_Tools_STATE_RANDOM) {
            cm_Tools_resolvePerm($cp, $cntUC, $parity);
            $cpVal = cm_Tools_getNPerm($cp, 8);
        } else
            while (true) {
                $cpVal = $gen.$nextInt(40320);
                if (cm_Util_getNParity($cpVal, 8) != $parity)
                    continue;
                else
                    break;
            }
    } else {
        if ($cp === cm_Tools_STATE_SOLVED) {
            $cpVal = 0;
            $parity = $cpVal;
        } else if ($cp !== cm_Tools_STATE_RANDOM) {
            $parity = cm_Tools_resolvePerm($cp, $cntUC, (-1));
            $cpVal = cm_Tools_getNPerm($cp, 8);
        } else {
            $cpVal = $gen.$nextInt(40320);
            $parity = cm_Util_getNParity($cpVal, 8);
        }
        if ($ep !== cm_Tools_STATE_RANDOM) {
            cm_Tools_resolvePerm($ep, $cntUE, $parity);
            $epVal = cm_Tools_getNPerm($ep, 12);
        } else
            while (true) {
                $epVal = $gen.$nextInt(479001600);
                if (cm_Util_getNParity($epVal, 12) != $parity)
                    continue;
                else
                    break;
            }
    }
    var$11 = new cm_CubieCube;
    var$12 = $co === cm_Tools_STATE_RANDOM ? $gen.$nextInt(2187) : $co === cm_Tools_STATE_SOLVED ? 0 : cm_Tools_resolveOri($co, 3);
    cm_CubieCube__init_1(var$11, $cpVal, var$12, $epVal, $eo === cm_Tools_STATE_RANDOM ? $gen.$nextInt(2048) : $eo === cm_Tools_STATE_SOLVED ? 0 : cm_Tools_resolveOri($eo, 2));
    return cm_Util_toFaceCube(var$11);
},
cm_Tools__clinit_ = () => {
    cm_Tools_gen = ju_Random__init_1();
    cm_Tools_STATE_RANDOM = null;
    cm_Tools_STATE_SOLVED = $rt_createByteArray(0);
};
function ju_HashMap$HashMapEntrySet() {
    ju_AbstractSet.call(this);
    this.$associatedMap0 = null;
}
let ju_HashMap$HashMapEntrySet__init_ = ($this, $hm) => {
    ju_AbstractSet__init_($this);
    $this.$associatedMap0 = $hm;
},
ju_HashMap$HashMapEntrySet__init_0 = var_0 => {
    let var_1 = new ju_HashMap$HashMapEntrySet();
    ju_HashMap$HashMapEntrySet__init_(var_1, var_0);
    return var_1;
},
ju_HashMap$HashMapEntrySet_iterator = $this => {
    return ju_HashMap$EntryIterator__init_0($this.$associatedMap0);
};
function jl_Byte() {
    jl_Number.call(this);
    this.$value7 = 0;
}
let jl_Byte_TYPE = null,
jl_Byte_byteCache = null,
jl_Byte_$callClinit = () => {
    jl_Byte_$callClinit = $rt_eraseClinit(jl_Byte);
    jl_Byte__clinit_();
},
jl_Byte__init_ = ($this, $value) => {
    jl_Byte_$callClinit();
    jl_Number__init_($this);
    $this.$value7 = $value;
},
jl_Byte__init_0 = var_0 => {
    let var_1 = new jl_Byte();
    jl_Byte__init_(var_1, var_0);
    return var_1;
},
jl_Byte_ensureByteCache = () => {
    let $byteCache, $j, var$3;
    jl_Byte_$callClinit();
    $byteCache = $rt_createArray(jl_Byte, 256);
    $j = 0;
    while (true) {
        var$3 = $byteCache.data;
        if ($j >= var$3.length)
            break;
        var$3[$j] = jl_Byte__init_0(($j - 128 | 0) << 24 >> 24);
        $j = $j + 1 | 0;
    }
    return $byteCache;
},
jl_Byte_hashCode = $value => {
    jl_Byte_$callClinit();
    return $value;
},
jl_Byte__clinit_ = () => {
    jl_Byte_TYPE = $rt_cls($rt_bytecls);
    jl_Byte_byteCache = jl_Byte_ensureByteCache();
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart();
    jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function jur_PatternSyntaxException() {
    let a = this; jl_IllegalArgumentException.call(a);
    a.$desc = null;
    a.$pattern1 = null;
    a.$index4 = 0;
}
let jur_PatternSyntaxException__init_0 = ($this, $description, $pattern, $index) => {
    jl_IllegalArgumentException__init_1($this);
    $this.$index4 = (-1);
    $this.$desc = $description;
    $this.$pattern1 = $pattern;
    $this.$index4 = $index;
},
jur_PatternSyntaxException__init_ = (var_0, var_1, var_2) => {
    let var_3 = new jur_PatternSyntaxException();
    jur_PatternSyntaxException__init_0(var_3, var_0, var_1, var_2);
    return var_3;
},
owtp_SkewbSolver = $rt_classWithoutFields(),
owtp_SkewbSolver_fact = null,
owtp_SkewbSolver_permmv = null,
owtp_SkewbSolver_twstmv = null,
owtp_SkewbSolver_permprun = null,
owtp_SkewbSolver_twstprun = null,
owtp_SkewbSolver_move2str = null,
owtp_SkewbSolver_cornerpermmv = null,
owtp_SkewbSolver_ori = null,
owtp_SkewbSolver_$callClinit = () => {
    owtp_SkewbSolver_$callClinit = $rt_eraseClinit(owtp_SkewbSolver);
    owtp_SkewbSolver__clinit_();
},
owtp_SkewbSolver__init_ = $this => {
    owtp_SkewbSolver_$callClinit();
    jl_Object__init_($this);
},
owtp_SkewbSolver__init_0 = () => {
    let var_0 = new owtp_SkewbSolver();
    owtp_SkewbSolver__init_(var_0);
    return var_0;
},
owtp_SkewbSolver_getpermmv = ($idx, $move) => {
    let $centerindex, $cornerindex, $val, $parity, $centerperm, $i, var$9, $p, $v, var$12, $m, var$14, $t, var$16;
    owtp_SkewbSolver_$callClinit();
    $centerindex = $idx / 12 | 0;
    $cornerindex = $idx % 12 | 0;
    $val = 5517840;
    $parity = 0;
    $centerperm = $rt_createIntArray(6);
    $i = 0;
    while ($i < 5) {
        var$9 = $centerperm.data;
        $p = owtp_SkewbSolver_fact.data[5 - $i | 0];
        $v = $centerindex / $p | 0;
        $centerindex = $centerindex - $rt_imul($v, $p) | 0;
        $parity = $parity ^ $v;
        var$12 = $v << 2;
        var$9[$i] = $val >> var$12 & 15;
        $m = (1 << var$12) - 1 | 0;
        $val = ($val & $m) + ($val >> 4 & ($m ^ (-1))) | 0;
        $i = $i + 1 | 0;
    }
    if (!($parity & 1))
        $centerperm.data[5] = $val;
    else {
        var$14 = $centerperm.data;
        var$14[5] = var$14[4];
        var$14[4] = $val;
    }
    if (!$move) {
        var$14 = $centerperm.data;
        $t = var$14[0];
        var$14[0] = var$14[1];
        var$14[1] = var$14[3];
        var$14[3] = $t;
    } else if ($move == 1) {
        var$14 = $centerperm.data;
        $t = var$14[0];
        var$14[0] = var$14[4];
        var$14[4] = var$14[2];
        var$14[2] = $t;
    } else if ($move == 2) {
        var$14 = $centerperm.data;
        $t = var$14[1];
        var$14[1] = var$14[2];
        var$14[2] = var$14[5];
        var$14[5] = $t;
    } else if ($move == 3) {
        var$14 = $centerperm.data;
        $t = var$14[3];
        var$14[3] = var$14[5];
        var$14[5] = var$14[4];
        var$14[4] = $t;
    }
    var$12 = 5517840;
    $i = 0;
    while ($i < 4) {
        $v = $centerperm.data[$i] << 2;
        var$16 = $rt_imul($centerindex, 6 - $i | 0);
        $centerindex = var$16 + (var$12 >> $v & 15) | 0;
        var$12 = Long_lo(Long_sub(Long_fromInt(var$12), Long_shl(Long_fromInt(1118480), $v)));
        $i = $i + 1 | 0;
    }
    return ($centerindex * 12 | 0) + owtp_SkewbSolver_cornerpermmv.data[$cornerindex].data[$move] | 0;
},
owtp_SkewbSolver_gettwstmv = ($idx, $move) => {
    let $fixedtwst, $twst, $i, var$6, var$7, $t;
    owtp_SkewbSolver_$callClinit();
    $fixedtwst = $rt_createIntArray(4);
    $twst = $rt_createIntArray(4);
    $i = 0;
    while ($i < 4) {
        $fixedtwst.data[$i] = $idx % 3 | 0;
        $idx = $idx / 3 | 0;
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 3) {
        $twst.data[$i] = $idx % 3 | 0;
        $idx = $idx / 3 | 0;
        $i = $i + 1 | 0;
    }
    a: {
        var$6 = $fixedtwst.data;
        var$7 = $twst.data;
        var$7[3] = (((6 - var$7[0] | 0) - var$7[1] | 0) - var$7[2] | 0) % 3 | 0;
        var$6[$move] = (var$6[$move] + 1 | 0) % 3 | 0;
        switch ($move) {
            case 0:
                break;
            case 1:
                $t = var$7[0];
                var$7[0] = var$7[1] + 2 | 0;
                var$7[1] = var$7[3] + 2 | 0;
                var$7[3] = $t + 2 | 0;
                break a;
            case 2:
                $t = var$7[0];
                var$7[0] = var$7[3] + 2 | 0;
                var$7[3] = var$7[2] + 2 | 0;
                var$7[2] = $t + 2 | 0;
                break a;
            case 3:
                $t = var$7[1];
                var$7[1] = var$7[2] + 2 | 0;
                var$7[2] = var$7[3] + 2 | 0;
                var$7[3] = $t + 2 | 0;
                break a;
            default:
                break a;
        }
        $t = var$7[0];
        var$7[0] = var$7[2] + 2 | 0;
        var$7[2] = var$7[1] + 2 | 0;
        var$7[1] = $t + 2 | 0;
    }
    $i = 2;
    while ($i >= 0) {
        $idx = ($idx * 3 | 0) + (var$7[$i] % 3 | 0) | 0;
        $i = $i + (-1) | 0;
    }
    $i = 3;
    while ($i >= 0) {
        $idx = ($idx * 3 | 0) + var$6[$i] | 0;
        $i = $i + (-1) | 0;
    }
    return $idx;
},
owtp_SkewbSolver_init = () => {
    let $i, $j, $l, $p, $m, $c, var$7, var$8;
    owtp_SkewbSolver_$callClinit();
    $i = 0;
    while ($i < 4320) {
        owtp_SkewbSolver_permprun.data[$i] = (-1);
        $j = 0;
        while ($j < 4) {
            owtp_SkewbSolver_permmv.data[$i].data[$j] = owtp_SkewbSolver_getpermmv($i, $j) & 65535;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
    $i = 0;
    while ($i < 2187) {
        owtp_SkewbSolver_twstprun.data[$i] = (-1);
        $j = 0;
        while ($j < 4) {
            owtp_SkewbSolver_twstmv.data[$i].data[$j] = owtp_SkewbSolver_gettwstmv($i, $j) & 65535;
            $j = $j + 1 | 0;
        }
        $i = $i + 1 | 0;
    }
    owtp_SkewbSolver_permprun.data[0] = 0;
    $l = 0;
    while ($l < 6) {
        $p = 0;
        while ($p < 4320) {
            a: {
                if (owtp_SkewbSolver_permprun.data[$p] == $l) {
                    $m = 0;
                    while (true) {
                        if ($m >= 4)
                            break a;
                        $c = 0;
                        var$7 = $p;
                        while ($c < 2) {
                            var$7 = owtp_SkewbSolver_permmv.data[var$7].data[$m];
                            if (owtp_SkewbSolver_permprun.data[var$7] == (-1))
                                owtp_SkewbSolver_permprun.data[var$7] = ($l + 1 | 0) << 24 >> 24;
                            $c = $c + 1 | 0;
                        }
                        $m = $m + 1 | 0;
                    }
                }
            }
            $p = $p + 1 | 0;
        }
        $l = $l + 1 | 0;
    }
    owtp_SkewbSolver_twstprun.data[0] = 0;
    $l = 0;
    while ($l < 6) {
        $p = 0;
        while ($p < 2187) {
            b: {
                if (owtp_SkewbSolver_twstprun.data[$p] == $l) {
                    $m = 0;
                    while (true) {
                        if ($m >= 4)
                            break b;
                        $c = 0;
                        var$8 = $p;
                        while ($c < 2) {
                            var$8 = owtp_SkewbSolver_twstmv.data[var$8].data[$m];
                            if (owtp_SkewbSolver_twstprun.data[var$8] == (-1))
                                owtp_SkewbSolver_twstprun.data[var$8] = ($l + 1 | 0) << 24 >> 24;
                            $c = $c + 1 | 0;
                        }
                        $m = $m + 1 | 0;
                    }
                }
            }
            $p = $p + 1 | 0;
        }
        $l = $l + 1 | 0;
    }
},
owtp_SkewbSolver_search = ($this, $depth, $perm, $twst, $maxl, $lm, $sol, $randomizeMoves) => {
    let $randomOffset, $m, $randomMove, $a, var$12, var$13, $searchResult;
    if (!$maxl) {
        if (!$perm && !$twst)
            return $depth;
        return (-1);
    }
    owtp_SkewbSolver_$callClinit();
    if (owtp_SkewbSolver_permprun.data[$perm] <= $maxl && owtp_SkewbSolver_twstprun.data[$twst] <= $maxl) {
        $randomOffset = $randomizeMoves.$nextInt(4);
        $m = 0;
        while ($m < 4) {
            a: {
                $randomMove = ($m + $randomOffset | 0) % 4 | 0;
                if ($randomMove != $lm) {
                    $a = 0;
                    var$12 = $perm;
                    var$13 = $twst;
                    while (true) {
                        if ($a >= 2)
                            break a;
                        var$12 = owtp_SkewbSolver_permmv.data[var$12].data[$randomMove];
                        var$13 = owtp_SkewbSolver_twstmv.data[var$13].data[$randomMove];
                        $searchResult = $this.$search1($depth + 1 | 0, var$12, var$13, $maxl - 1 | 0, $randomMove, $sol, $randomizeMoves);
                        if ($searchResult != (-1)) {
                            $sol.data[$depth] = ($randomMove * 2 | 0) + $a | 0;
                            return $searchResult;
                        }
                        $a = $a + 1 | 0;
                    }
                }
            }
            $m = $m + 1 | 0;
        }
        return (-1);
    }
    return (-1);
},
owtp_SkewbSolver_randomState = ($this, $r) => {
    let $state;
    $state = owtp_SkewbSolver$SkewbSolverState__init_0();
    $state.$perm = $r.$nextInt(4320);
    while (true) {
        $state.$twst = $r.$nextInt(2187);
        if (!$state.$isSolvable())
            continue;
        else
            break;
    }
    return $state;
},
owtp_SkewbSolver_generateExactly = ($this, $state, $length, $randomizeMoves) => {
    let $sol, $solutionLength;
    $sol = $rt_createIntArray(12);
    $solutionLength = $this.$search1(0, $state.$perm, $state.$twst, $length, (-1), $sol, $randomizeMoves);
    if ($solutionLength == (-1))
        return null;
    return owtp_SkewbSolver_getSolution($this, $sol, $solutionLength);
},
owtp_SkewbSolver_getSolution = ($this, $sol, $solutionLength) => {
    let $sb, $move2str, var$5, $i, var$7, $axis, $pow, $p, $temp;
    $sb = jl_StringBuilder__init_();
    $move2str = $rt_createArray(jl_String, 4);
    var$5 = $move2str.data;
    var$5[0] = $rt_s(222);
    var$5[1] = $rt_s(20);
    var$5[2] = $rt_s(228);
    var$5[3] = $rt_s(17);
    $i = 0;
    while ($i < $solutionLength) {
        a: {
            var$7 = $sol.data;
            $axis = var$7[$i] >> 1;
            $pow = var$7[$i] & 1;
            if ($axis == 2) {
                $p = 0;
                while (true) {
                    if ($p > $pow)
                        break a;
                    $temp = var$5[0];
                    var$5[0] = var$5[1];
                    var$5[1] = var$5[3];
                    var$5[3] = $temp;
                    $p = $p + 1 | 0;
                }
            }
        }
        ($sb.$append1(var$5[$axis])).$append1($pow != 1 ? $rt_s(3) : $rt_s(4));
        $sb.$append1($rt_s(16));
        $i = $i + 1 | 0;
    }
    return ($sb.$toString()).$trim();
},
owtp_SkewbSolver_access$000 = () => {
    owtp_SkewbSolver_$callClinit();
    return owtp_SkewbSolver_ori;
},
owtp_SkewbSolver__clinit_ = () => {
    let var$1, var$2;
    owtp_SkewbSolver_fact = $rt_createIntArrayFromData([1, 1, 1, 3, 12, 60, 360]);
    owtp_SkewbSolver_permmv = $rt_createCharMultiArray([4, 4320]);
    owtp_SkewbSolver_twstmv = $rt_createCharMultiArray([4, 2187]);
    owtp_SkewbSolver_permprun = $rt_createByteArray(4320);
    owtp_SkewbSolver_twstprun = $rt_createByteArray(2187);
    owtp_SkewbSolver_move2str = $rt_wrapArray(jl_String, [$rt_s(231), $rt_s(281), $rt_s(236), $rt_s(282), $rt_s(233), $rt_s(283), $rt_s(239), $rt_s(284)]);
    var$1 = $rt_createArray($rt_arraycls($rt_bytecls), 12);
    var$2 = var$1.data;
    var$2[0] = $rt_createByteArrayFromData([6, 5, 10, 1]);
    var$2[1] = $rt_createByteArrayFromData([9, 7, 4, 2]);
    var$2[2] = $rt_createByteArrayFromData([3, 11, 8, 0]);
    var$2[3] = $rt_createByteArrayFromData([10, 1, 6, 5]);
    var$2[4] = $rt_createByteArrayFromData([0, 8, 11, 3]);
    var$2[5] = $rt_createByteArrayFromData([7, 9, 2, 4]);
    var$2[6] = $rt_createByteArrayFromData([4, 2, 9, 7]);
    var$2[7] = $rt_createByteArrayFromData([11, 3, 0, 8]);
    var$2[8] = $rt_createByteArrayFromData([1, 10, 5, 6]);
    var$2[9] = $rt_createByteArrayFromData([8, 0, 3, 11]);
    var$2[10] = $rt_createByteArrayFromData([2, 4, 7, 9]);
    var$2[11] = $rt_createByteArrayFromData([5, 6, 1, 10]);
    owtp_SkewbSolver_cornerpermmv = var$1;
    owtp_SkewbSolver_ori = $rt_createByteArrayFromData([0, 1, 2, 0, 2, 1, 1, 2, 0, 2, 1, 0]);
    owtp_SkewbSolver_init();
};
function jul_Logger() {
    let a = this; jl_Object.call(a);
    a.$name2 = null;
    a.$parent = null;
}
let jul_Logger_loggerCache = null,
jul_Logger_$callClinit = () => {
    jul_Logger_$callClinit = $rt_eraseClinit(jul_Logger);
    jul_Logger__clinit_();
},
jul_Logger__init_ = ($this, $name) => {
    jul_Logger_$callClinit();
    jl_Object__init_($this);
    $this.$name2 = $name;
},
jul_Logger__init_0 = var_0 => {
    let var_1 = new jul_Logger();
    jul_Logger__init_(var_1, var_0);
    return var_1;
},
jul_Logger_getLogger = $name => {
    let $logger, $dotIndex, $parentName;
    jul_Logger_$callClinit();
    $logger = jul_Logger_loggerCache.$get($name);
    if ($logger === null) {
        $logger = jul_Logger__init_0($name);
        $dotIndex = $name.$lastIndexOf2(46);
        if ($dotIndex >= 0) {
            $parentName = $name.$substring(0, $dotIndex);
            $logger.$parent = jul_Logger_getLogger($parentName);
        } else if (!$name.$isEmpty())
            $logger.$parent = jul_Logger_getLogger($rt_s(3));
        jul_Logger_loggerCache.$put($name, $logger);
    }
    return $logger;
},
jul_Logger_log = ($this, $record) => {
    let $message;
    $message = jul_Logger_format($this, $record.$getMessage(), $record.$getParameters());
    if (jul_Level_intValue($record.$getLevel()) >= jul_Level_intValue(jul_Level_SEVERE))
        jul_Logger_error$js_body$_40($rt_ustr($message));
    else if (jul_Level_intValue($record.$getLevel()) < jul_Level_intValue(jul_Level_WARNING))
        jul_Logger_infoImpl$js_body$_38($rt_ustr($message));
    else
        jul_Logger_warn$js_body$_39($rt_ustr($message));
},
jul_Logger_format = ($this, $message, $params) => {
    let $sb, $index, $next, $paramStart, $index_0, var$8, $paramIndex;
    if ($params === null)
        return $message;
    $sb = jl_StringBuilder__init_();
    $index = 0;
    a: {
        while (true) {
            if ($index >= $message.$length())
                break a;
            $next = $message.$indexOf2(123, $index);
            if ($next < 0)
                break a;
            $paramStart = $next + 1 | 0;
            $index_0 = jul_Logger_digits($paramStart, $message);
            if ($index_0 < 0)
                break;
            if ($message.$charAt($index_0) != 125) {
                $sb.$append14($message, $index, $index_0);
                $index = $index_0;
                continue;
            }
            var$8 = $params.data;
            $paramIndex = jl_Integer_parseInt0($message.$substring($paramStart, $index_0));
            if ($paramIndex >= var$8.length) {
                $sb.$append14($message, $index, $index_0);
                $index = $index_0;
                continue;
            }
            $sb.$append(var$8[$paramIndex]);
            $index = $index_0 + 1 | 0;
        }
    }
    return $sb.$toString();
},
jul_Logger_digits = ($from, $message) => {
    let $from_0, $c;
    jul_Logger_$callClinit();
    while (true) {
        if ($from >= $message.$length())
            return (-1);
        $from_0 = $from + 1 | 0;
        $c = $message.$charAt($from);
        if ($c <= 48)
            break;
        if ($c >= 57)
            break;
        $from = $from_0;
    }
    return $from_0;
},
jul_Logger_log0 = ($this, $level, $msg) => {
    $this.$log(jul_LogRecord__init_0($level, $msg));
},
jul_Logger_severe = ($this, $msg) => {
    jul_Level_$callClinit();
    $this.$log0(jul_Level_SEVERE, $msg);
},
jul_Logger_fine = ($this, $msg) => {
    jul_Level_$callClinit();
    $this.$log0(jul_Level_FINE, $msg);
},
jul_Logger__clinit_ = () => {
    jul_Logger_loggerCache = ju_HashMap__init_();
},
jul_Logger_infoImpl$js_body$_38 = var$1 => {
    if (console) {
        console.info(var$1);
    }
},
jul_Logger_warn$js_body$_39 = var$1 => {
    if (console) {
        console.warn(var$1);
    }
},
jul_Logger_error$js_body$_40 = var$1 => {
    if (console) {
        console.error(var$1);
    }
};
function jul_LogRecord() {
    let a = this; jl_Object.call(a);
    a.$level = null;
    a.$message0 = null;
    a.$millis = Long_ZERO;
    a.$parameters = null;
    a.$sequenceNumber = Long_ZERO;
    a.$threadID = Long_ZERO;
}
let jul_LogRecord_sequenceNumberGenerator = Long_ZERO,
jul_LogRecord__init_ = ($this, var$1, $msg) => {
    let var$3;
    jl_Object__init_($this);
    $this.$level = var$1;
    $this.$message0 = $msg;
    $this.$millis = jl_System_currentTimeMillis();
    var$3 = jul_LogRecord_sequenceNumberGenerator;
    jul_LogRecord_sequenceNumberGenerator = Long_add(var$3, Long_fromInt(1));
    $this.$sequenceNumber = var$3;
    $this.$threadID = (jl_Thread_currentThread()).$getId();
},
jul_LogRecord__init_0 = (var_0, var_1) => {
    let var_2 = new jul_LogRecord();
    jul_LogRecord__init_(var_2, var_0, var_1);
    return var_2;
},
jul_LogRecord_getLevel = $this => {
    return $this.$level;
},
jul_LogRecord_getMessage = $this => {
    return $this.$message0;
},
jul_LogRecord_getParameters = $this => {
    return $this.$parameters;
},
jur_AbstractCharClass$LazyJavaDefined = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaDefined__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaDefined__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaDefined();
    jur_AbstractCharClass$LazyJavaDefined__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaDefined_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaDefined$1__init_0($this);
    $chCl.$lowHighSurrogates.$set(0, 2048);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function jur_Pattern() {
    let a = this; jl_Object.call(a);
    a.$lexemes = null;
    a.$flags = 0;
    a.$backRefs = null;
    a.$needsBackRefReplacement = 0;
    a.$globalGroupIndex = 0;
    a.$compCount0 = 0;
    a.$consCount0 = 0;
    a.$start1 = null;
    a.$namedGroups0 = null;
}
let jur_Pattern_matcher = ($this, $input) => {
    return jur_Matcher__init_0($this, $input);
},
jur_Pattern_split0 = ($this, $inputSeq, $limit) => {
    let $res, $mat, $index, $curPos, var$7, var$8;
    $res = ju_ArrayList__init_();
    $mat = jur_Pattern_matcher($this, $inputSeq);
    $index = 0;
    $curPos = 0;
    if (!$inputSeq.$length()) {
        var$7 = $rt_createArray(jl_String, 1);
        var$7.data[0] = $rt_s(3);
        return var$7;
    }
    while (jur_Matcher_find0($mat)) {
        var$8 = $index + 1 | 0;
        if (var$8 >= $limit && $limit > 0)
            break;
        $res.$add(($inputSeq.$subSequence($curPos, jur_Matcher_start($mat))).$toString());
        $curPos = jur_Matcher_end0($mat);
        $index = var$8;
    }
    a: {
        $res.$add(($inputSeq.$subSequence($curPos, $inputSeq.$length())).$toString());
        var$8 = $index + 1 | 0;
        if (!$limit)
            while (true) {
                var$8 = var$8 + (-1) | 0;
                if (var$8 < 0)
                    break;
                if ((($res.$get0(var$8)).$toString()).$length())
                    break a;
                $res.$remove0(var$8);
            }
    }
    if (var$8 < 0)
        var$8 = 0;
    return $res.$toArray($rt_createArray(jl_String, var$8));
},
jur_Pattern_split = ($this, $input) => {
    return jur_Pattern_split0($this, $input, 0);
},
jur_Pattern_pattern = $this => {
    return $this.$lexemes.$toString();
},
jur_Pattern_compile0 = ($pattern, $flags) => {
    if ($pattern === null)
        $rt_throw(jl_NullPointerException__init_($rt_s(285)));
    if ($flags && ($flags | 255) != 255)
        $rt_throw(jl_IllegalArgumentException__init_0($rt_s(3)));
    jur_AbstractSet_$callClinit();
    jur_AbstractSet_counter = 1;
    return jur_Pattern_compileImpl(jur_Pattern__init_0(), $pattern, $flags);
},
jur_Pattern_compileImpl = ($this, $pattern, $flags) => {
    $this.$lexemes = jur_Lexer__init_0($pattern, $flags);
    $this.$flags = $flags;
    $this.$start1 = jur_Pattern_processExpression($this, (-1), $this.$flags, null);
    if ($this.$lexemes.$isEmpty()) {
        jur_Pattern_finalizeCompile($this);
        return $this;
    }
    $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$lexemes.$toString(), $this.$lexemes.$getIndex()));
},
jur_Pattern_processAlternations = ($this, $last) => {
    let $auxRange, var$3, $rangeSet;
    $auxRange = jur_CharClass__init_4(jur_Pattern_hasFlag($this, 2), jur_Pattern_hasFlag($this, 64));
    while (!$this.$lexemes.$isEmpty()) {
        var$3 = $this.$lexemes;
        if (!var$3.$isLetter0())
            break;
        var$3 = $this.$lexemes;
        if (var$3.$lookAhead() && $this.$lexemes.$lookAhead() != (-536870788)) {
            var$3 = $this.$lexemes;
            if (var$3.$lookAhead() != (-536870871))
                break;
        }
        $auxRange.$add0($this.$lexemes.$next2());
        if ($this.$lexemes.$peek() != (-536870788))
            continue;
        $this.$lexemes.$next2();
    }
    $rangeSet = jur_Pattern_processRangeSet($this, $auxRange);
    $rangeSet.$setNext($last);
    return $rangeSet;
},
jur_Pattern_processExpression = ($this, $ch, $newFlags, $last) => {
    let $children, $saveFlags, $saveChangedFlags, $fSet, var$8, $child;
    $children = ju_ArrayList__init_();
    $saveFlags = $this.$flags;
    $saveChangedFlags = 0;
    if ($newFlags != $this.$flags)
        $this.$flags = $newFlags;
    a: {
        switch ($ch) {
            case -1073741784:
                $fSet = new jur_NonCapFSet;
                var$8 = $this.$consCount0 + 1 | 0;
                $this.$consCount0 = var$8;
                jur_NonCapFSet__init_($fSet, var$8);
                break a;
            case -536870872:
            case -268435416:
                break;
            case -134217688:
            case -67108824:
                $fSet = new jur_BehindFSet;
                var$8 = $this.$consCount0 + 1 | 0;
                $this.$consCount0 = var$8;
                jur_BehindFSet__init_($fSet, var$8);
                break a;
            case -33554392:
                $fSet = new jur_AtomicFSet;
                var$8 = $this.$consCount0 + 1 | 0;
                $this.$consCount0 = var$8;
                jur_AtomicFSet__init_($fSet, var$8);
                break a;
            default:
                $this.$globalGroupIndex = $this.$globalGroupIndex + 1 | 0;
                if ($last === null) {
                    $fSet = jur_FinalSet__init_0();
                    $saveChangedFlags = 1;
                } else {
                    $fSet = jur_FSet__init_0($this.$globalGroupIndex);
                    if ($ch == (-2130706392)) {
                        if ($this.$namedGroups0 === null)
                            $this.$namedGroups0 = ju_LinkedHashMap__init_();
                        $this.$namedGroups0.$put($this.$lexemes.$groupName, jl_Integer_valueOf($this.$globalGroupIndex));
                    }
                }
                if ($this.$globalGroupIndex <= (-1))
                    break a;
                if ($this.$globalGroupIndex >= 10)
                    break a;
                $this.$backRefs.data[$this.$globalGroupIndex] = $fSet;
                break a;
        }
        $fSet = jur_AheadFSet__init_0();
    }
    while (true) {
        if ($this.$lexemes.$isLetter0() && $this.$lexemes.$lookAhead() == (-536870788))
            $child = jur_Pattern_processAlternations($this, $fSet);
        else if ($this.$lexemes.$peek() == (-536870788)) {
            $child = jur_EmptySet__init_($fSet);
            $this.$lexemes.$next2();
        } else {
            $child = jur_Pattern_processSubExpression($this, $fSet);
            if ($this.$lexemes.$peek() == (-536870788))
                $this.$lexemes.$next2();
        }
        if ($child !== null)
            $children.$add($child);
        if ($this.$lexemes.$isEmpty())
            break;
        if ($this.$lexemes.$peek() == (-536870871))
            break;
    }
    if ($this.$lexemes.$back() == (-536870788))
        $children.$add(jur_EmptySet__init_($fSet));
    if ($this.$flags != $saveFlags && !$saveChangedFlags) {
        $this.$flags = $saveFlags;
        $this.$lexemes.$restoreFlags($this.$flags);
    }
    switch ($ch) {
        case -1073741784:
            break;
        case -536870872:
            return jur_PositiveLookAhead__init_0($children, $fSet);
        case -268435416:
            return jur_NegativeLookAhead__init_0($children, $fSet);
        case -134217688:
            return jur_PositiveLookBehind__init_0($children, $fSet);
        case -67108824:
            return jur_NegativeLookBehind__init_0($children, $fSet);
        case -33554392:
            return jur_AtomicJointSet__init_0($children, $fSet);
        default:
            switch ($children.$size()) {
                case 0:
                    break;
                case 1:
                    return jur_SingleSet__init_0($children.$get0(0), $fSet);
                default:
                    return jur_JointSet__init_1($children, $fSet);
            }
            return jur_EmptySet__init_($fSet);
    }
    return jur_NonCapJointSet__init_0($children, $fSet);
},
jur_Pattern_processSequence = $this => {
    let $substring, var$2, $ch;
    $substring = jl_StringBuffer__init_();
    while (!$this.$lexemes.$isEmpty()) {
        var$2 = $this.$lexemes;
        if (!var$2.$isLetter0())
            break;
        var$2 = $this.$lexemes;
        if (var$2.$isHighSurrogate0())
            break;
        var$2 = $this.$lexemes;
        if (var$2.$isLowSurrogate0())
            break;
        var$2 = $this.$lexemes;
        if (!(!var$2.$isNextSpecial() && !$this.$lexemes.$lookAhead())) {
            var$2 = $this.$lexemes;
            if (!(!var$2.$isNextSpecial() && jur_Lexer_isLetter($this.$lexemes.$lookAhead()))) {
                var$2 = $this.$lexemes;
                if (var$2.$lookAhead() != (-536870871)) {
                    var$2 = $this.$lexemes;
                    if ((var$2.$lookAhead() & (-2147418113)) != (-2147483608)) {
                        var$2 = $this.$lexemes;
                        if (var$2.$lookAhead() != (-536870788)) {
                            var$2 = $this.$lexemes;
                            if (var$2.$lookAhead() != (-536870876))
                                break;
                        }
                    }
                }
            }
        }
        $ch = $this.$lexemes.$next2();
        if (!jl_Character_isSupplementaryCodePoint($ch))
            $substring.$append17($ch & 65535);
        else
            $substring.$append20(jl_Character_toChars($ch));
    }
    if (!jur_Pattern_hasFlag($this, 2))
        return jur_SequenceSet__init_0($substring);
    if (jur_Pattern_hasFlag($this, 64))
        return jur_UCISequenceSet__init_0($substring);
    return jur_CISequenceSet__init_0($substring);
},
jur_Pattern_processDecomposedChar = $this => {
    let $codePoints, $readCodePoints, $curSymb, $curSymbIndex, var$5, $codePointsHangul, var$7, var$8, var$9, var$10;
    $codePoints = $rt_createIntArray(4);
    $readCodePoints = 0;
    $curSymb = (-1);
    $curSymbIndex = (-1);
    if (!$this.$lexemes.$isEmpty() && $this.$lexemes.$isLetter0()) {
        var$5 = $codePoints.data;
        $curSymb = $this.$lexemes.$next2();
        var$5[$readCodePoints] = $curSymb;
        $curSymbIndex = $curSymb - 4352 | 0;
    }
    if ($curSymbIndex >= 0 && $curSymbIndex < 19) {
        $codePointsHangul = $rt_createCharArray(3);
        var$5 = $codePointsHangul.data;
        var$5[$readCodePoints] = $curSymb & 65535;
        var$7 = $this.$lexemes.$peek();
        var$8 = var$7 - 4449 | 0;
        if (var$8 >= 0 && var$8 < 21) {
            var$5[1] = var$7 & 65535;
            $this.$lexemes.$next2();
            var$9 = $this.$lexemes.$peek();
            var$7 = var$9 - 4519 | 0;
            if (var$7 >= 0 && var$7 < 28) {
                var$5[2] = var$9 & 65535;
                $this.$lexemes.$next2();
                return jur_HangulDecomposedCharSet__init_0($codePointsHangul, 3);
            }
            return jur_HangulDecomposedCharSet__init_0($codePointsHangul, 2);
        }
        if (!jur_Pattern_hasFlag($this, 2))
            return jur_CharSet__init_(var$5[0]);
        if (jur_Pattern_hasFlag($this, 64))
            return jur_UCICharSet__init_0(var$5[0]);
        return jur_CICharSet__init_(var$5[0]);
    }
    var$10 = 1;
    while (var$10 < 4 && !$this.$lexemes.$isEmpty() && $this.$lexemes.$isLetter0()) {
        var$5 = $codePoints.data;
        var$9 = var$10 + 1 | 0;
        var$5[var$10] = $this.$lexemes.$next2();
        var$10 = var$9;
    }
    if (var$10 == 1) {
        var$5 = $codePoints.data;
        if (!jur_Lexer_hasSingleCodepointDecomposition(var$5[0]))
            return jur_Pattern_processCharSet($this, var$5[0]);
    }
    if (!jur_Pattern_hasFlag($this, 2))
        return jur_DecomposedCharSet__init_0($codePoints, var$10);
    if (jur_Pattern_hasFlag($this, 64))
        return jur_UCIDecomposedCharSet__init_0($codePoints, var$10);
    return jur_CIDecomposedCharSet__init_0($codePoints, var$10);
},
jur_Pattern_processSubExpression = ($this, $last) => {
    let $cur, $term, var$4, $next;
    if ($this.$lexemes.$isLetter0() && !$this.$lexemes.$isNextSpecial() && jur_Lexer_isLetter($this.$lexemes.$lookAhead())) {
        if (!jur_Pattern_hasFlag($this, 128)) {
            if (!$this.$lexemes.$isHighSurrogate0() && !$this.$lexemes.$isLowSurrogate0())
                $cur = jur_Pattern_processSequence($this);
            else {
                $term = jur_Pattern_processTerminal($this, $last);
                $cur = jur_Pattern_processQuantifier($this, $last, $term);
            }
        } else {
            $cur = jur_Pattern_processDecomposedChar($this);
            if (!$this.$lexemes.$isEmpty()) {
                var$4 = $this.$lexemes;
                if (!(var$4.$peek() == (-536870871) && !($last instanceof jur_FinalSet))) {
                    var$4 = $this.$lexemes;
                    if (var$4.$peek() != (-536870788) && !$this.$lexemes.$isLetter0())
                        $cur = jur_Pattern_processQuantifier($this, $last, $cur);
                }
            }
        }
    } else if ($this.$lexemes.$peek() != (-536870871)) {
        $term = jur_Pattern_processTerminal($this, $last);
        $cur = jur_Pattern_processQuantifier($this, $last, $term);
    } else {
        if ($last instanceof jur_FinalSet)
            $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$lexemes.$toString(), $this.$lexemes.$getIndex()));
        $cur = jur_EmptySet__init_($last);
    }
    a: {
        if (!$this.$lexemes.$isEmpty()) {
            var$4 = $this.$lexemes;
            if (!(var$4.$peek() == (-536870871) && !($last instanceof jur_FinalSet))) {
                var$4 = $this.$lexemes;
                if (var$4.$peek() != (-536870788)) {
                    $next = jur_Pattern_processSubExpression($this, $last);
                    if ($cur instanceof jur_LeafQuantifierSet && !($cur instanceof jur_CompositeQuantifierSet) && !($cur instanceof jur_GroupQuantifierSet) && !($cur instanceof jur_AltQuantifierSet)) {
                        var$4 = $cur;
                        if (!$next.$first(var$4.$getInnerSet()))
                            $cur = jur_UnifiedQuantifierSet__init_0(var$4);
                    }
                    if (($next.$getType() & 65535) != 43)
                        $cur.$setNext($next);
                    else
                        $cur.$setNext($next.$getInnerSet());
                    break a;
                }
            }
        }
        if ($cur === null)
            return null;
        $cur.$setNext($last);
    }
    if (($cur.$getType() & 65535) != 43)
        return $cur;
    return $cur.$getInnerSet();
},
jur_Pattern_processQuantifier = ($this, $last, $term) => {
    let $quant, var$4, var$5, var$6, $q, var$8, $leaf;
    $quant = $this.$lexemes.$peek();
    if ($term !== null && !($term instanceof jur_LeafSet)) {
        switch ($quant) {
            case -2147483606:
                $this.$lexemes.$next2();
                return jur_PossessiveGroupQuantifierSet__init_0($term, $last, $quant);
            case -2147483605:
                $this.$lexemes.$next2();
                return jur_PosPlusGroupQuantifierSet__init_0($term, $last, (-2147483606));
            case -2147483585:
                $this.$lexemes.$next2();
                return jur_PosAltGroupQuantifierSet__init_0($term, $last, (-536870849));
            case -2147483525:
                var$4 = new jur_PosCompositeGroupQuantifierSet;
                var$5 = $this.$lexemes.$nextSpecial();
                var$6 = $this.$compCount0 + 1 | 0;
                $this.$compCount0 = var$6;
                jur_PosCompositeGroupQuantifierSet__init_(var$4, var$5, $term, $last, (-536870849), var$6);
                return var$4;
            case -1073741782:
            case -1073741781:
                $this.$lexemes.$next2();
                $q = jur_ReluctantGroupQuantifierSet__init_0($term, $last, $quant);
                $term.$setNext($q);
                return $q;
            case -1073741761:
                $this.$lexemes.$next2();
                $q = jur_RelAltGroupQuantifierSet__init_0($term, $last, (-536870849));
                $term.$setNext($last);
                return $q;
            case -1073741701:
                $q = new jur_RelCompositeGroupQuantifierSet;
                var$4 = $this.$lexemes;
                var$4 = var$4.$nextSpecial();
                var$8 = $this.$compCount0 + 1 | 0;
                $this.$compCount0 = var$8;
                jur_RelCompositeGroupQuantifierSet__init_($q, var$4, $term, $last, (-536870849), var$8);
                $term.$setNext($q);
                return $q;
            case -536870870:
            case -536870869:
                $this.$lexemes.$next2();
                $q = $term.$getType() != (-2147483602) ? jur_GroupQuantifierSet__init_0($term, $last, $quant) : jur_Pattern_hasFlag($this, 32) ? jur_DotAllQuantifierSet__init_0($term, $last, $quant) : jur_DotQuantifierSet__init_0($term, $last, $quant, jur_AbstractLineTerminator_getInstance($this.$flags));
                $term.$setNext($q);
                return $q;
            case -536870849:
                $this.$lexemes.$next2();
                $q = jur_AltGroupQuantifierSet__init_0($term, $last, (-536870849));
                $term.$setNext($last);
                return $q;
            case -536870789:
                $q = new jur_CompositeGroupQuantifierSet;
                var$4 = $this.$lexemes;
                var$4 = var$4.$nextSpecial();
                var$6 = $this.$compCount0 + 1 | 0;
                $this.$compCount0 = var$6;
                jur_CompositeGroupQuantifierSet__init_($q, var$4, $term, $last, (-536870849), var$6);
                $term.$setNext($q);
                return $q;
            default:
        }
        return $term;
    }
    $leaf = null;
    if ($term !== null)
        $leaf = $term;
    switch ($quant) {
        case -2147483606:
        case -2147483605:
            $this.$lexemes.$next2();
            $q = jur_PossessiveQuantifierSet__init_0($leaf, $last, $quant);
            $leaf.$setNext($q);
            return $q;
        case -2147483585:
            $this.$lexemes.$next2();
            return jur_PossessiveAltQuantifierSet__init_0($leaf, $last, (-2147483585));
        case -2147483525:
            return jur_PossessiveCompositeQuantifierSet__init_0($this.$lexemes.$nextSpecial(), $leaf, $last, (-2147483525));
        case -1073741782:
        case -1073741781:
            $this.$lexemes.$next2();
            $q = jur_ReluctantQuantifierSet__init_0($leaf, $last, $quant);
            $leaf.$setNext($q);
            return $q;
        case -1073741761:
            $this.$lexemes.$next2();
            return jur_ReluctantAltQuantifierSet__init_0($leaf, $last, (-1073741761));
        case -1073741701:
            return jur_ReluctantCompositeQuantifierSet__init_0($this.$lexemes.$nextSpecial(), $leaf, $last, (-1073741701));
        case -536870870:
        case -536870869:
            $this.$lexemes.$next2();
            $q = jur_LeafQuantifierSet__init_0($leaf, $last, $quant);
            $leaf.$setNext($q);
            return $q;
        case -536870849:
            $this.$lexemes.$next2();
            return jur_AltQuantifierSet__init_0($leaf, $last, (-536870849));
        case -536870789:
            return jur_CompositeQuantifierSet__init_0($this.$lexemes.$nextSpecial(), $leaf, $last, (-536870789));
        default:
    }
    return $term;
},
jur_Pattern_processTerminal = ($this, $last) => {
    let $term, $ch, $newFlags, var$5, $negative, $cc, $number, var$9, var$10, var$11;
    $term = null;
    while (true) {
        a: {
            $ch = $this.$lexemes.$peek();
            if (($ch & (-2147418113)) == (-2147483608)) {
                $this.$lexemes.$next2();
                $newFlags = ($ch & 16711680) >> 16;
                $ch = $ch & (-16711681);
                if ($ch == (-16777176))
                    $this.$flags = $newFlags;
                else {
                    if ($ch != (-1073741784))
                        $newFlags = $this.$flags;
                    $term = jur_Pattern_processExpression($this, $ch, $newFlags, $last);
                    if ($this.$lexemes.$peek() != (-536870871))
                        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$lexemes.$toString(), $this.$lexemes.$getIndex()));
                    $this.$lexemes.$next2();
                }
            } else {
                b: {
                    c: {
                        switch ($ch) {
                            case -2147483599:
                            case -2147483598:
                            case -2147483597:
                            case -2147483596:
                            case -2147483595:
                            case -2147483594:
                            case -2147483593:
                            case -2147483592:
                            case -2147483591:
                                break c;
                            case -2147483583:
                                break;
                            case -2147483582:
                                $this.$lexemes.$next2();
                                $term = jur_WordBoundary__init_(0);
                                break a;
                            case -2147483577:
                                $this.$lexemes.$next2();
                                $term = jur_PreviousMatch__init_0();
                                break a;
                            case -2147483558:
                                $this.$lexemes.$next2();
                                $term = new jur_EOLSet;
                                var$5 = $this.$consCount0 + 1 | 0;
                                $this.$consCount0 = var$5;
                                jur_EOLSet__init_($term, var$5);
                                break a;
                            case -2147483550:
                                $this.$lexemes.$next2();
                                $term = jur_WordBoundary__init_(1);
                                break a;
                            case -2147483526:
                                $this.$lexemes.$next2();
                                $term = jur_EOISet__init_0();
                                break a;
                            case -536870876:
                                $this.$lexemes.$next2();
                                $this.$consCount0 = $this.$consCount0 + 1 | 0;
                                if (jur_Pattern_hasFlag($this, 8)) {
                                    if (jur_Pattern_hasFlag($this, 1)) {
                                        $term = jur_UMultiLineEOLSet__init_0($this.$consCount0);
                                        break a;
                                    }
                                    $term = jur_MultiLineEOLSet__init_0($this.$consCount0);
                                    break a;
                                }
                                if (jur_Pattern_hasFlag($this, 1)) {
                                    $term = jur_UEOLSet__init_0($this.$consCount0);
                                    break a;
                                }
                                $term = jur_EOLSet__init_0($this.$consCount0);
                                break a;
                            case -536870866:
                                $this.$lexemes.$next2();
                                if (jur_Pattern_hasFlag($this, 32)) {
                                    $term = jur_DotAllSet__init_0();
                                    break a;
                                }
                                $term = jur_DotSet__init_0(jur_AbstractLineTerminator_getInstance($this.$flags));
                                break a;
                            case -536870821:
                                $this.$lexemes.$next2();
                                $negative = 0;
                                if ($this.$lexemes.$peek() == (-536870818)) {
                                    $negative = 1;
                                    $this.$lexemes.$next2();
                                }
                                $term = jur_Pattern_processRange($this, $negative, $last);
                                if ($this.$lexemes.$peek() != (-536870819))
                                    $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$lexemes.$toString(), $this.$lexemes.$getIndex()));
                                $this.$lexemes.$setMode(1);
                                $this.$lexemes.$next2();
                                break a;
                            case -536870818:
                                $this.$lexemes.$next2();
                                $this.$consCount0 = $this.$consCount0 + 1 | 0;
                                if (!jur_Pattern_hasFlag($this, 8)) {
                                    $term = jur_SOLSet__init_0();
                                    break a;
                                }
                                $term = jur_MultiLineSOLSet__init_0(jur_AbstractLineTerminator_getInstance($this.$flags));
                                break a;
                            case 0:
                                $cc = $this.$lexemes.$peekSpecial();
                                if ($cc !== null)
                                    $term = jur_Pattern_processRangeSet($this, $cc);
                                else {
                                    if ($this.$lexemes.$isEmpty()) {
                                        $term = jur_EmptySet__init_($last);
                                        break a;
                                    }
                                    $term = jur_CharSet__init_($ch & 65535);
                                }
                                $this.$lexemes.$next2();
                                break a;
                            default:
                                break b;
                        }
                        $this.$lexemes.$next2();
                        $term = jur_SOLSet__init_0();
                        break a;
                    }
                    $number = ($ch & 2147483647) - 48 | 0;
                    if ($this.$globalGroupIndex < $number)
                        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$lexemes.$toString(), $this.$lexemes.$getIndex()));
                    $this.$lexemes.$next2();
                    $this.$consCount0 = $this.$consCount0 + 1 | 0;
                    $term = !jur_Pattern_hasFlag($this, 2) ? jur_BackReferenceSet__init_0($number, $this.$consCount0) : jur_Pattern_hasFlag($this, 64) ? jur_UCIBackReferenceSet__init_0($number, $this.$consCount0) : jur_CIBackReferenceSet__init_0($number, $this.$consCount0);
                    $this.$backRefs.data[$number].$isBackReferenced = 1;
                    $this.$needsBackRefReplacement = 1;
                    break a;
                }
                if ($ch >= 0 && !$this.$lexemes.$isSpecial()) {
                    $term = jur_Pattern_processCharSet($this, $ch);
                    $this.$lexemes.$next2();
                } else if ($ch == (-536870788))
                    $term = jur_EmptySet__init_($last);
                else {
                    if ($ch != (-536870871)) {
                        var$9 = new jur_PatternSyntaxException;
                        var$10 = !$this.$lexemes.$isSpecial() ? jl_Character_toString($ch & 65535) : ($this.$lexemes.$peekSpecial()).$toString();
                        var$11 = $this.$lexemes;
                        jur_PatternSyntaxException__init_0(var$9, var$10, var$11.$toString(), $this.$lexemes.$getIndex());
                        $rt_throw(var$9);
                    }
                    if ($last instanceof jur_FinalSet)
                        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$lexemes.$toString(), $this.$lexemes.$getIndex()));
                    $term = jur_EmptySet__init_($last);
                }
            }
        }
        if ($ch != (-16777176))
            break;
    }
    return $term;
},
jur_Pattern_processRange = ($this, $negative, $last) => {
    let $res, $rangeSet;
    $res = jur_Pattern_processRangeExpression($this, $negative);
    $rangeSet = jur_Pattern_processRangeSet($this, $res);
    $rangeSet.$setNext($last);
    return $rangeSet;
},
jur_Pattern_processRangeExpression = ($this, $alt) => {
    let $res, $buffer, $intersection, $notClosed, $firstInClass, var$7, $cur, $negative, $cs, $$je;
    $res = jur_CharClass__init_3($alt, jur_Pattern_hasFlag($this, 2), jur_Pattern_hasFlag($this, 64));
    $buffer = (-1);
    $intersection = 0;
    $notClosed = 0;
    $firstInClass = 1;
    a: {
        b: {
            c: while (true) {
                if ($this.$lexemes.$isEmpty())
                    break a;
                $notClosed = $this.$lexemes.$peek() == (-536870819) && !$firstInClass ? 0 : 1;
                if (!$notClosed)
                    break a;
                d: {
                    switch ($this.$lexemes.$peek()) {
                        case -536870874:
                            if ($buffer >= 0)
                                $res.$add0($buffer);
                            $buffer = $this.$lexemes.$next2();
                            if ($this.$lexemes.$peek() != (-536870874)) {
                                $buffer = 38;
                                break d;
                            }
                            if ($this.$lexemes.$lookAhead() == (-536870821)) {
                                $this.$lexemes.$next2();
                                $intersection = 1;
                                $buffer = (-1);
                                break d;
                            }
                            $this.$lexemes.$next2();
                            if ($firstInClass) {
                                $res = jur_Pattern_processRangeExpression($this, 0);
                                break d;
                            }
                            if ($this.$lexemes.$peek() == (-536870819))
                                break d;
                            $res.$intersection(jur_Pattern_processRangeExpression($this, 0));
                            break d;
                        case -536870867:
                            if (!$firstInClass && $this.$lexemes.$lookAhead() != (-536870819)) {
                                var$7 = $this.$lexemes;
                                if (var$7.$lookAhead() != (-536870821) && $buffer >= 0) {
                                    $this.$lexemes.$next2();
                                    $cur = $this.$lexemes.$peek();
                                    if ($this.$lexemes.$isSpecial())
                                        break c;
                                    if ($cur < 0) {
                                        var$7 = $this.$lexemes;
                                        if (var$7.$lookAhead() != (-536870819)) {
                                            var$7 = $this.$lexemes;
                                            if (var$7.$lookAhead() != (-536870821) && $buffer >= 0)
                                                break c;
                                        }
                                    }
                                    e: {
                                        try {
                                            if (jur_Lexer_isLetter($cur))
                                                break e;
                                            $cur = $cur & 65535;
                                            break e;
                                        } catch ($$e) {
                                            $$je = $rt_wrapException($$e);
                                            if ($$je instanceof jl_Exception) {
                                                break b;
                                            } else {
                                                throw $$e;
                                            }
                                        }
                                    }
                                    try {
                                        $res.$add1($buffer, $cur);
                                    } catch ($$e) {
                                        $$je = $rt_wrapException($$e);
                                        if ($$je instanceof jl_Exception) {
                                            break b;
                                        } else {
                                            throw $$e;
                                        }
                                    }
                                    $this.$lexemes.$next2();
                                    $buffer = (-1);
                                    break d;
                                }
                            }
                            if ($buffer >= 0)
                                $res.$add0($buffer);
                            $buffer = 45;
                            $this.$lexemes.$next2();
                            break d;
                        case -536870821:
                            if ($buffer >= 0) {
                                $res.$add0($buffer);
                                $buffer = (-1);
                            }
                            $this.$lexemes.$next2();
                            $negative = 0;
                            if ($this.$lexemes.$peek() == (-536870818)) {
                                $this.$lexemes.$next2();
                                $negative = 1;
                            }
                            if (!$intersection)
                                $res.$union(jur_Pattern_processRangeExpression($this, $negative));
                            else
                                $res.$intersection(jur_Pattern_processRangeExpression($this, $negative));
                            $intersection = 0;
                            $this.$lexemes.$next2();
                            break d;
                        case -536870819:
                            if ($buffer >= 0)
                                $res.$add0($buffer);
                            $buffer = 93;
                            $this.$lexemes.$next2();
                            break d;
                        case -536870818:
                            if ($buffer >= 0)
                                $res.$add0($buffer);
                            $buffer = 94;
                            $this.$lexemes.$next2();
                            break d;
                        case 0:
                            if ($buffer >= 0)
                                $res.$add0($buffer);
                            $cs = $this.$lexemes.$peekSpecial();
                            if ($cs === null)
                                $buffer = 0;
                            else {
                                $res.$add4($cs);
                                $buffer = (-1);
                            }
                            $this.$lexemes.$next2();
                            break d;
                        default:
                    }
                    if ($buffer >= 0)
                        $res.$add0($buffer);
                    $buffer = $this.$lexemes.$next2();
                }
                $firstInClass = 0;
            }
            $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), jur_Pattern_pattern($this), $this.$lexemes.$getIndex()));
        }
        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), jur_Pattern_pattern($this), $this.$lexemes.$getIndex()));
    }
    if (!$notClosed) {
        if ($buffer >= 0)
            $res.$add0($buffer);
        return $res;
    }
    $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), jur_Pattern_pattern($this), $this.$lexemes.$getIndex() - 1 | 0));
},
jur_Pattern_processCharSet = ($this, $ch) => {
    let $isSupplCodePoint;
    $isSupplCodePoint = jl_Character_isSupplementaryCodePoint($ch);
    if (jur_Pattern_hasFlag($this, 2)) {
        a: {
            if (!($ch >= 97 && $ch <= 122)) {
                if ($ch < 65)
                    break a;
                if ($ch > 90)
                    break a;
            }
            return jur_CICharSet__init_($ch & 65535);
        }
        if (jur_Pattern_hasFlag($this, 64) && $ch > 128) {
            if ($isSupplCodePoint)
                return jur_UCISupplCharSet__init_0($ch);
            if (jur_Lexer_isLowSurrogate($ch))
                return jur_LowSurrogateCharSet__init_($ch & 65535);
            if (!jur_Lexer_isHighSurrogate($ch))
                return jur_UCICharSet__init_0($ch & 65535);
            return jur_HighSurrogateCharSet__init_0($ch & 65535);
        }
    }
    if ($isSupplCodePoint)
        return jur_SupplCharSet__init_0($ch);
    if (jur_Lexer_isLowSurrogate($ch))
        return jur_LowSurrogateCharSet__init_($ch & 65535);
    if (!jur_Lexer_isHighSurrogate($ch))
        return jur_CharSet__init_($ch & 65535);
    return jur_HighSurrogateCharSet__init_0($ch & 65535);
},
jur_Pattern_processRangeSet = ($this, $charClass) => {
    let $surrogates, $lowHighSurrRangeSet;
    if (!$charClass.$hasLowHighSurrogates()) {
        if (!$charClass.$mayContainSupplCodepoints()) {
            if ($charClass.$hasUCI())
                return jur_UCIRangeSet__init_0($charClass);
            return jur_RangeSet__init_0($charClass);
        }
        if ($charClass.$hasUCI())
            return jur_UCISupplRangeSet__init_($charClass);
        return jur_SupplRangeSet__init_0($charClass);
    }
    $surrogates = $charClass.$getSurrogates();
    $lowHighSurrRangeSet = jur_LowHighSurrogateRangeSet__init_0($surrogates);
    if (!$charClass.$mayContainSupplCodepoints()) {
        if ($charClass.$hasUCI())
            return jur_CompositeRangeSet__init_(jur_UCIRangeSet__init_0($charClass.$getWithoutSurrogates()), $lowHighSurrRangeSet);
        return jur_CompositeRangeSet__init_(jur_RangeSet__init_0($charClass.$getWithoutSurrogates()), $lowHighSurrRangeSet);
    }
    if ($charClass.$hasUCI())
        return jur_CompositeRangeSet__init_(jur_UCISupplRangeSet__init_($charClass.$getWithoutSurrogates()), $lowHighSurrRangeSet);
    return jur_CompositeRangeSet__init_(jur_SupplRangeSet__init_0($charClass.$getWithoutSurrogates()), $lowHighSurrRangeSet);
},
jur_Pattern_compile = $pattern => {
    return jur_Pattern_compile0($pattern, 0);
},
jur_Pattern_finalizeCompile = $this => {
    if ($this.$needsBackRefReplacement)
        $this.$start1.$processSecondPass();
    if ($this.$namedGroups0 === null)
        $this.$namedGroups0 = ju_Collections_emptyMap();
    else
        $this.$namedGroups0 = ju_Collections_unmodifiableMap($this.$namedGroups0);
},
jur_Pattern_quote = $s => {
    let $sb, $apos, var$4, $apos_0;
    $sb = (jl_StringBuilder__init_()).$append1($rt_s(286));
    $apos = 0;
    while (true) {
        var$4 = $s.$indexOf1($rt_s(287), $apos);
        if (var$4 < 0)
            break;
        $apos_0 = var$4 + 2 | 0;
        ($sb.$append1($s.$substring($apos, $apos_0))).$append1($rt_s(288));
        $apos = $apos_0;
    }
    return (($sb.$append1($s.$substring0($apos))).$append1($rt_s(287))).$toString();
},
jur_Pattern_namedGroups = $this => {
    return $this.$namedGroups0;
},
jur_Pattern_groupCount = $this => {
    return $this.$globalGroupIndex;
},
jur_Pattern_compCount = $this => {
    return $this.$compCount0 + 1 | 0;
},
jur_Pattern_consCount = $this => {
    return $this.$consCount0 + 1 | 0;
},
jur_Pattern_getSupplement = $ch => {
    if ($ch >= 97 && $ch <= 122)
        $ch = ($ch - 32 | 0) & 65535;
    else if ($ch >= 65 && $ch <= 90)
        $ch = ($ch + 32 | 0) & 65535;
    return $ch;
},
jur_Pattern_hasFlag = ($this, $flag) => {
    return ($this.$flags & $flag) != $flag ? 0 : 1;
},
jur_Pattern__init_ = $this => {
    jl_Object__init_($this);
    $this.$backRefs = $rt_createArray(jur_FSet, 10);
    $this.$globalGroupIndex = (-1);
    $this.$compCount0 = (-1);
    $this.$consCount0 = (-1);
},
jur_Pattern__init_0 = () => {
    let var_0 = new jur_Pattern();
    jur_Pattern__init_(var_0);
    return var_0;
},
jur_PosAltGroupQuantifierSet = $rt_classWithoutFields(jur_AltGroupQuantifierSet),
jur_PosAltGroupQuantifierSet__init_ = ($this, $innerSet, $next, $type) => {
    jur_AltGroupQuantifierSet__init_($this, $innerSet, $next, $type);
    jur_FSet_$callClinit();
    $innerSet.$setNext(jur_FSet_posFSet);
},
jur_PosAltGroupQuantifierSet__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new jur_PosAltGroupQuantifierSet();
    jur_PosAltGroupQuantifierSet__init_(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_PosAltGroupQuantifierSet_matches = ($this, $stringIndex, $testString, $matchResult) => {
    let $nextIndex;
    $nextIndex = $this.$innerSet.$matches($stringIndex, $testString, $matchResult);
    if ($nextIndex <= 0)
        $nextIndex = $stringIndex;
    return $this.$next3.$matches($nextIndex, $testString, $matchResult);
},
jur_PosAltGroupQuantifierSet_setNext = ($this, $next) => {
    $this.$next3 = $next;
};
function owts_AlgorithmBuilder$IndexAndMove() {
    let a = this; jl_Object.call(a);
    a.$index0 = 0;
    a.$move0 = null;
}
let owts_AlgorithmBuilder$IndexAndMove__init_0 = ($this, $index, $move) => {
    jl_Object__init_($this);
    $this.$index0 = $index;
    $this.$move0 = $move;
},
owts_AlgorithmBuilder$IndexAndMove__init_ = (var_0, var_1) => {
    let var_2 = new owts_AlgorithmBuilder$IndexAndMove();
    owts_AlgorithmBuilder$IndexAndMove__init_0(var_2, var_0, var_1);
    return var_2;
};
function owts_Color() {
    let a = this; jl_Object.call(a);
    a.$r0 = 0;
    a.$g = 0;
    a.$b = 0;
    a.$a = 0;
}
let owts_Color_RED = null,
owts_Color_GREEN = null,
owts_Color_BLUE = null,
owts_Color_WHITE = null,
owts_Color_BLACK = null,
owts_Color_GRAY = null,
owts_Color_YELLOW = null,
owts_Color_$callClinit = () => {
    owts_Color_$callClinit = $rt_eraseClinit(owts_Color);
    owts_Color__clinit_();
},
owts_Color__init_1 = ($this, $r, $g, $b, $a) => {
    owts_Color_$callClinit();
    jl_Object__init_($this);
    $this.$r0 = $r;
    $this.$g = $g;
    $this.$b = $b;
    $this.$a = $a;
},
owts_Color__init_4 = (var_0, var_1, var_2, var_3) => {
    let var_4 = new owts_Color();
    owts_Color__init_1(var_4, var_0, var_1, var_2, var_3);
    return var_4;
},
owts_Color__init_2 = ($this, $r, $g, $b) => {
    owts_Color_$callClinit();
    owts_Color__init_1($this, $r, $g, $b, 255);
},
owts_Color__init_ = (var_0, var_1, var_2) => {
    let var_3 = new owts_Color();
    owts_Color__init_2(var_3, var_0, var_1, var_2);
    return var_3;
},
owts_Color__init_3 = ($this, $rgba) => {
    owts_Color_$callClinit();
    owts_Color__init_1($this, ($rgba >>> 16 | 0) & 255, ($rgba >>> 8 | 0) & 255, $rgba & 255, ($rgba >>> 24 | 0) & 255);
},
owts_Color__init_0 = var_0 => {
    let var_1 = new owts_Color();
    owts_Color__init_3(var_1, var_0);
    return var_1;
},
owts_Color__clinit_ = () => {
    owts_Color_RED = owts_Color__init_(255, 0, 0);
    owts_Color_GREEN = owts_Color__init_(0, 255, 0);
    owts_Color_BLUE = owts_Color__init_(0, 0, 255);
    owts_Color_WHITE = owts_Color__init_(255, 255, 255);
    owts_Color_BLACK = owts_Color__init_(0, 0, 0);
    owts_Color_GRAY = owts_Color__init_(128, 128, 128);
    owts_Color_YELLOW = owts_Color__init_(255, 255, 0);
};
function ju_Collections$13() {
    ju_AbstractMap.call(this);
    this.$val$m = null;
}
let ju_Collections$13__init_ = ($this, var$1) => {
    $this.$val$m = var$1;
    ju_AbstractMap__init_($this);
},
ju_Collections$13__init_0 = var_0 => {
    let var_1 = new ju_Collections$13();
    ju_Collections$13__init_(var_1, var_0);
    return var_1;
},
jur_AbstractCharClass$LazyJavaIdentifierIgnorable = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaIdentifierIgnorable__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaIdentifierIgnorable__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaIdentifierIgnorable();
    jur_AbstractCharClass$LazyJavaIdentifierIgnorable__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaIdentifierIgnorable_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function jur_UMultiLineEOLSet() {
    jur_AbstractSet.call(this);
    this.$consCounter2 = 0;
}
let jur_UMultiLineEOLSet__init_ = ($this, $counter) => {
    jur_AbstractSet__init_($this);
    $this.$consCounter2 = $counter;
},
jur_UMultiLineEOLSet__init_0 = var_0 => {
    let var_1 = new jur_UMultiLineEOLSet();
    jur_UMultiLineEOLSet__init_(var_1, var_0);
    return var_1;
},
jur_UMultiLineEOLSet_matches = ($this, $strIndex, $testString, $matchResult) => {
    let $strDif;
    $strDif = !$matchResult.$hasAnchoringBounds() ? $testString.$length() - $strIndex | 0 : $matchResult.$getRightBound() - $strIndex | 0;
    if ($strDif <= 0) {
        $matchResult.$setConsumed($this.$consCounter2, 0);
        return $this.$next3.$matches($strIndex, $testString, $matchResult);
    }
    if ($testString.$charAt($strIndex) != 10)
        return (-1);
    $matchResult.$setConsumed($this.$consCounter2, 1);
    return $this.$next3.$matches($strIndex + 1 | 0, $testString, $matchResult);
},
jur_UMultiLineEOLSet_hasConsumed = ($this, $matchResult) => {
    let $res;
    $res = !$matchResult.$getConsumed($this.$consCounter2) ? 0 : 1;
    $matchResult.$setConsumed($this.$consCounter2, (-1));
    return $res;
},
jur_AbstractCharClass$LazyJavaLetterOrDigit = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaLetterOrDigit__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaLetterOrDigit__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaLetterOrDigit();
    jur_AbstractCharClass$LazyJavaLetterOrDigit__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaLetterOrDigit_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaLetterOrDigit$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function otciu_UnicodeHelper$Range() {
    let a = this; jl_Object.call(a);
    a.$start2 = 0;
    a.$end1 = 0;
    a.$data0 = null;
}
let otciu_UnicodeHelper$Range__init_ = ($this, $start, $end, $data) => {
    jl_Object__init_($this);
    $this.$start2 = $start;
    $this.$end1 = $end;
    $this.$data0 = $data;
},
otciu_UnicodeHelper$Range__init_0 = (var_0, var_1, var_2) => {
    let var_3 = new otciu_UnicodeHelper$Range();
    otciu_UnicodeHelper$Range__init_(var_3, var_0, var_1, var_2);
    return var_3;
};
function jur_EOLSet() {
    jur_AbstractSet.call(this);
    this.$consCounter0 = 0;
}
let jur_EOLSet__init_ = ($this, $counter) => {
    jur_AbstractSet__init_($this);
    $this.$consCounter0 = $counter;
},
jur_EOLSet__init_0 = var_0 => {
    let var_1 = new jur_EOLSet();
    jur_EOLSet__init_(var_1, var_0);
    return var_1;
},
jur_EOLSet_matches = ($this, $strIndex, $testString, $matchResult) => {
    let $rightBound, var$5, var$6, $ch;
    $rightBound = !$matchResult.$hasAnchoringBounds() ? $testString.$length() : $matchResult.$getRightBound();
    if ($strIndex >= $rightBound) {
        $matchResult.$setConsumed($this.$consCounter0, 0);
        return $this.$next3.$matches($strIndex, $testString, $matchResult);
    }
    var$5 = $rightBound - $strIndex | 0;
    if (var$5 == 2 && $testString.$charAt($strIndex) == 13) {
        var$6 = $strIndex + 1 | 0;
        if ($testString.$charAt(var$6) == 10) {
            $matchResult.$setConsumed($this.$consCounter0, 0);
            return $this.$next3.$matches($strIndex, $testString, $matchResult);
        }
    }
    a: {
        if (var$5 == 1) {
            $ch = $testString.$charAt($strIndex);
            if ($ch == 10)
                break a;
            if ($ch == 13)
                break a;
            if ($ch == 133)
                break a;
            if (($ch | 1) == 8233)
                break a;
        }
        return (-1);
    }
    $matchResult.$setConsumed($this.$consCounter0, 0);
    return $this.$next3.$matches($strIndex, $testString, $matchResult);
},
jur_EOLSet_hasConsumed = ($this, $matchResult) => {
    let $res;
    $res = !$matchResult.$getConsumed($this.$consCounter0) ? 0 : 1;
    $matchResult.$setConsumed($this.$consCounter0, (-1));
    return $res;
},
otr_StringInfo = $rt_classWithoutFields(otrr_ReflectionInfo),
jur_AbstractLineTerminator$2 = $rt_classWithoutFields(jur_AbstractLineTerminator),
jur_AbstractLineTerminator$2__init_ = $this => {
    jur_AbstractLineTerminator__init_($this);
},
jur_AbstractLineTerminator$2__init_0 = () => {
    let var_0 = new jur_AbstractLineTerminator$2();
    jur_AbstractLineTerminator$2__init_(var_0);
    return var_0;
},
jur_AbstractLineTerminator$2_isLineTerminator = ($this, $ch) => {
    return $ch != 10 && $ch != 13 && $ch != 133 && ($ch | 1) != 8233 ? 0 : 1;
},
jur_AbstractLineTerminator$2_isAfterLineTerminator = ($this, $ch, $ch2) => {
    let var$3;
    a: {
        b: {
            if ($ch != 10 && $ch != 133 && ($ch | 1) != 8233) {
                if ($ch != 13)
                    break b;
                if ($ch2 == 10)
                    break b;
            }
            var$3 = 1;
            break a;
        }
        var$3 = 0;
    }
    return var$3;
};
function otciu_CharMapping() {
    let a = this; jl_Object.call(a);
    a.$binarySearchTable0 = null;
    a.$fastTable = null;
}
let otciu_CharMapping__init_ = ($this, $binarySearchTable, $fastTable) => {
    jl_Object__init_($this);
    $this.$binarySearchTable0 = $binarySearchTable;
    $this.$fastTable = $fastTable;
},
otciu_CharMapping__init_0 = (var_0, var_1) => {
    let var_2 = new otciu_CharMapping();
    otciu_CharMapping__init_(var_2, var_0, var_1);
    return var_2;
},
jur_AbstractLineTerminator$1 = $rt_classWithoutFields(jur_AbstractLineTerminator),
jur_AbstractLineTerminator$1__init_ = $this => {
    jur_AbstractLineTerminator__init_($this);
},
jur_AbstractLineTerminator$1__init_0 = () => {
    let var_0 = new jur_AbstractLineTerminator$1();
    jur_AbstractLineTerminator$1__init_(var_0);
    return var_0;
},
jur_AbstractLineTerminator$1_isLineTerminator = ($this, $ch) => {
    return $ch != 10 ? 0 : 1;
},
jur_AbstractLineTerminator$1_isAfterLineTerminator = ($this, $ch, $ch2) => {
    return $ch != 10 ? 0 : 1;
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart();
    jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart_computeValue = $this => {
    let $chCl;
    $chCl = jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1__init_0($this);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function jur_Lexer() {
    let a = this; jl_Object.call(a);
    a.$pattern0 = null;
    a.$flags0 = 0;
    a.$mode0 = 0;
    a.$savedMode = 0;
    a.$lookBack = 0;
    a.$ch = 0;
    a.$lookAhead0 = 0;
    a.$groupName = null;
    a.$patternFullLength = 0;
    a.$curST = null;
    a.$lookAheadST = null;
    a.$index = 0;
    a.$prevNW = 0;
    a.$curToc = 0;
    a.$lookAheadToc = 0;
    a.$orig = null;
}
let jur_Lexer_decompTable = null,
jur_Lexer_singleDecompTable = null,
jur_Lexer_singleDecompTableSize = 0,
jur_Lexer__init_ = ($this, $pattern, $flags) => {
    jl_Object__init_($this);
    $this.$mode0 = 1;
    $this.$orig = $pattern;
    if (($flags & 16) > 0)
        $pattern = jur_Pattern_quote($pattern);
    else if (($flags & 128) > 0)
        $pattern = jur_Lexer_normalize($pattern);
    $this.$pattern0 = $rt_createCharArray($pattern.$length() + 2 | 0);
    jl_System_fastArraycopy($pattern.$toCharArray(), 0, $this.$pattern0, 0, $pattern.$length());
    $this.$pattern0.data[$this.$pattern0.data.length - 1 | 0] = 0;
    $this.$pattern0.data[$this.$pattern0.data.length - 2 | 0] = 0;
    $this.$patternFullLength = $this.$pattern0.data.length;
    $this.$flags0 = $flags;
    jur_Lexer_movePointer($this);
    jur_Lexer_movePointer($this);
},
jur_Lexer__init_0 = (var_0, var_1) => {
    let var_2 = new jur_Lexer();
    jur_Lexer__init_(var_2, var_0, var_1);
    return var_2;
},
jur_Lexer_peek = $this => {
    return $this.$ch;
},
jur_Lexer_setMode = ($this, $mode) => {
    if ($mode > 0 && $mode < 3)
        $this.$mode0 = $mode;
    if ($mode == 1)
        jur_Lexer_reread($this);
},
jur_Lexer_restoreFlags = ($this, $flags) => {
    $this.$flags0 = $flags;
    $this.$lookAhead0 = $this.$ch;
    $this.$lookAheadST = $this.$curST;
    $this.$index = $this.$curToc + 1 | 0;
    $this.$lookAheadToc = $this.$curToc;
    jur_Lexer_movePointer($this);
},
jur_Lexer_peekSpecial = $this => {
    return $this.$curST;
},
jur_Lexer_isSpecial = $this => {
    return $this.$curST === null ? 0 : 1;
},
jur_Lexer_isNextSpecial = $this => {
    return $this.$lookAheadST === null ? 0 : 1;
},
jur_Lexer_next = $this => {
    jur_Lexer_movePointer($this);
    return $this.$lookBack;
},
jur_Lexer_nextSpecial = $this => {
    let $res;
    $res = $this.$curST;
    jur_Lexer_movePointer($this);
    return $res;
},
jur_Lexer_lookAhead = $this => {
    return $this.$lookAhead0;
},
jur_Lexer_back = $this => {
    return $this.$lookBack;
},
jur_Lexer_normalize = $input => {
    return $input;
},
jur_Lexer_reread = $this => {
    $this.$lookAhead0 = $this.$ch;
    $this.$lookAheadST = $this.$curST;
    $this.$index = $this.$lookAheadToc;
    $this.$lookAheadToc = $this.$curToc;
    jur_Lexer_movePointer($this);
},
jur_Lexer_movePointer = $this => {
    let $reread, var$2, $cs, $negative, $nonCap, $behindOrNamed, $nameBuilder, var$8, $mod, $$je;
    $this.$lookBack = $this.$ch;
    $this.$ch = $this.$lookAhead0;
    $this.$curST = $this.$lookAheadST;
    $this.$curToc = $this.$lookAheadToc;
    $this.$lookAheadToc = $this.$index;
    a: {
        while (true) {
            $reread = 0;
            $this.$lookAhead0 = $this.$index >= $this.$pattern0.data.length ? 0 : jur_Lexer_nextCodePoint($this);
            $this.$lookAheadST = null;
            if ($this.$mode0 == 4) {
                if ($this.$lookAhead0 != 92)
                    return;
                $this.$lookAhead0 = $this.$index >= $this.$pattern0.data.length ? 0 : $this.$pattern0.data[jur_Lexer_nextIndex($this)];
                switch ($this.$lookAhead0) {
                    case 69:
                        break;
                    default:
                        $this.$lookAhead0 = 92;
                        $this.$index = $this.$prevNW;
                        return;
                }
                $this.$mode0 = $this.$savedMode;
                $this.$lookAhead0 = $this.$index > ($this.$pattern0.data.length - 2 | 0) ? 0 : jur_Lexer_nextCodePoint($this);
            }
            b: {
                if ($this.$lookAhead0 == 92) {
                    var$2 = $this.$index >= ($this.$pattern0.data.length - 2 | 0) ? (-1) : jur_Lexer_nextCodePoint($this);
                    c: {
                        $this.$lookAhead0 = var$2;
                        switch ($this.$lookAhead0) {
                            case -1:
                                $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                            case 5:
                            case 6:
                            case 7:
                            case 8:
                            case 9:
                            case 10:
                            case 11:
                            case 12:
                            case 13:
                            case 14:
                            case 15:
                            case 16:
                            case 17:
                            case 18:
                            case 19:
                            case 20:
                            case 21:
                            case 22:
                            case 23:
                            case 24:
                            case 25:
                            case 26:
                            case 27:
                            case 28:
                            case 29:
                            case 30:
                            case 31:
                            case 32:
                            case 33:
                            case 34:
                            case 35:
                            case 36:
                            case 37:
                            case 38:
                            case 39:
                            case 40:
                            case 41:
                            case 42:
                            case 43:
                            case 44:
                            case 45:
                            case 46:
                            case 47:
                            case 58:
                            case 59:
                            case 60:
                            case 61:
                            case 62:
                            case 63:
                            case 64:
                            case 91:
                            case 92:
                            case 93:
                            case 94:
                            case 95:
                            case 96:
                            case 118:
                                break;
                            case 48:
                                $this.$lookAhead0 = jur_Lexer_readOctals($this);
                                break b;
                            case 49:
                            case 50:
                            case 51:
                            case 52:
                            case 53:
                            case 54:
                            case 55:
                            case 56:
                            case 57:
                                if ($this.$mode0 != 1)
                                    break b;
                                $this.$lookAhead0 = (-2147483648) | $this.$lookAhead0;
                                break b;
                            case 65:
                                $this.$lookAhead0 = (-2147483583);
                                break b;
                            case 66:
                                $this.$lookAhead0 = (-2147483582);
                                break b;
                            case 67:
                            case 69:
                            case 70:
                            case 72:
                            case 73:
                            case 74:
                            case 75:
                            case 76:
                            case 77:
                            case 78:
                            case 79:
                            case 82:
                            case 84:
                            case 85:
                            case 86:
                            case 88:
                            case 89:
                            case 103:
                            case 104:
                            case 105:
                            case 106:
                            case 107:
                            case 108:
                            case 109:
                            case 111:
                            case 113:
                            case 121:
                                $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
                            case 68:
                            case 83:
                            case 87:
                            case 100:
                            case 115:
                            case 119:
                                $this.$lookAheadST = jur_AbstractCharClass_getPredefinedClass(jl_String__init_1($this.$pattern0, $this.$prevNW, 1), 0);
                                $this.$lookAhead0 = 0;
                                break b;
                            case 71:
                                $this.$lookAhead0 = (-2147483577);
                                break b;
                            case 80:
                            case 112:
                                break c;
                            case 81:
                                $this.$savedMode = $this.$mode0;
                                $this.$mode0 = 4;
                                $reread = 1;
                                break b;
                            case 90:
                                $this.$lookAhead0 = (-2147483558);
                                break b;
                            case 97:
                                $this.$lookAhead0 = 7;
                                break b;
                            case 98:
                                $this.$lookAhead0 = (-2147483550);
                                break b;
                            case 99:
                                if ($this.$index >= ($this.$pattern0.data.length - 2 | 0))
                                    $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
                                $this.$lookAhead0 = $this.$pattern0.data[jur_Lexer_nextIndex($this)] & 31;
                                break b;
                            case 101:
                                $this.$lookAhead0 = 27;
                                break b;
                            case 102:
                                $this.$lookAhead0 = 12;
                                break b;
                            case 110:
                                $this.$lookAhead0 = 10;
                                break b;
                            case 114:
                                $this.$lookAhead0 = 13;
                                break b;
                            case 116:
                                $this.$lookAhead0 = 9;
                                break b;
                            case 117:
                                $this.$lookAhead0 = jur_Lexer_readHex($this, 4);
                                break b;
                            case 120:
                                $this.$lookAhead0 = jur_Lexer_readHex($this, 2);
                                break b;
                            case 122:
                                $this.$lookAhead0 = (-2147483526);
                                break b;
                            default:
                        }
                        break b;
                    }
                    $cs = jur_Lexer_parseCharClassName($this);
                    $negative = 0;
                    if ($this.$lookAhead0 == 80)
                        $negative = 1;
                    try {
                        $this.$lookAheadST = jur_AbstractCharClass_getPredefinedClass($cs, $negative);
                    } catch ($$e) {
                        $$je = $rt_wrapException($$e);
                        if ($$je instanceof ju_MissingResourceException) {
                            $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
                        } else {
                            throw $$e;
                        }
                    }
                    $this.$lookAhead0 = 0;
                } else if ($this.$mode0 == 1)
                    switch ($this.$lookAhead0) {
                        case 36:
                            $this.$lookAhead0 = (-536870876);
                            break b;
                        case 40:
                            if ($this.$pattern0.data[$this.$index] != 63) {
                                $this.$lookAhead0 = (-2147483608);
                                break b;
                            }
                            jur_Lexer_nextIndex($this);
                            $nonCap = $this.$pattern0.data[$this.$index];
                            $behindOrNamed = 0;
                            $nameBuilder = null;
                            while (true) {
                                d: {
                                    if (!$behindOrNamed) {
                                        switch ($nonCap) {
                                            case 33:
                                                break;
                                            case 60:
                                                jur_Lexer_nextIndex($this);
                                                $nonCap = $this.$pattern0.data[$this.$index];
                                                $behindOrNamed = 1;
                                                break d;
                                            case 61:
                                                $this.$lookAhead0 = (-536870872);
                                                jur_Lexer_nextIndex($this);
                                                break d;
                                            case 62:
                                                $this.$lookAhead0 = (-33554392);
                                                jur_Lexer_nextIndex($this);
                                                break d;
                                            default:
                                                $this.$lookAhead0 = jur_Lexer_readFlags($this);
                                                if ($this.$lookAhead0 < 256) {
                                                    $this.$flags0 = $this.$lookAhead0;
                                                    $this.$lookAhead0 = $this.$lookAhead0 << 16;
                                                    $this.$lookAhead0 = (-1073741784) | $this.$lookAhead0;
                                                    break d;
                                                }
                                                $this.$lookAhead0 = $this.$lookAhead0 & 255;
                                                $this.$flags0 = $this.$lookAhead0;
                                                $this.$lookAhead0 = $this.$lookAhead0 << 16;
                                                $this.$lookAhead0 = (-16777176) | $this.$lookAhead0;
                                                break d;
                                        }
                                        $this.$lookAhead0 = (-268435416);
                                        jur_Lexer_nextIndex($this);
                                    } else {
                                        e: {
                                            switch ($nonCap) {
                                                case 33:
                                                    break;
                                                case 61:
                                                    $behindOrNamed = 0;
                                                    $this.$lookAhead0 = (-134217688);
                                                    jur_Lexer_nextIndex($this);
                                                    break d;
                                                case 62:
                                                    if ($nameBuilder === null)
                                                        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
                                                    $this.$groupName = $nameBuilder.$toString();
                                                    jur_Lexer_nextIndex($this);
                                                    $nameBuilder = null;
                                                    $behindOrNamed = 0;
                                                    $this.$lookAhead0 = (-2130706392);
                                                    break d;
                                                default:
                                                    break e;
                                            }
                                            $behindOrNamed = 0;
                                            $this.$lookAhead0 = (-67108824);
                                            jur_Lexer_nextIndex($this);
                                            break d;
                                        }
                                        f: {
                                            if (!($nonCap >= 65 && $nonCap <= 90)) {
                                                if ($nonCap < 97)
                                                    break f;
                                                if ($nonCap > 122)
                                                    break f;
                                            }
                                            if ($nameBuilder === null)
                                                $nameBuilder = jl_StringBuilder__init_();
                                            $nameBuilder.$append0($nonCap);
                                            jur_Lexer_nextIndex($this);
                                            $nonCap = $this.$pattern0.data[$this.$index];
                                            break d;
                                        }
                                        if ($nonCap < 48)
                                            break a;
                                        if ($nonCap > 57)
                                            break a;
                                        if ($nameBuilder === null) {
                                            var$8 = jur_PatternSyntaxException__init_($rt_s(289), $this.$toString(), $this.$index);
                                            $rt_throw(var$8);
                                        }
                                        $nameBuilder.$append0($nonCap);
                                        jur_Lexer_nextIndex($this);
                                        $nonCap = $this.$pattern0.data[$this.$index];
                                    }
                                }
                                if (!$behindOrNamed)
                                    break;
                            }
                            break b;
                        case 41:
                            $this.$lookAhead0 = (-536870871);
                            break b;
                        case 42:
                        case 43:
                        case 63:
                            $mod = $this.$index >= $this.$pattern0.data.length ? 42 : $this.$pattern0.data[$this.$index];
                            switch ($mod) {
                                case 43:
                                    $this.$lookAhead0 = $this.$lookAhead0 | (-2147483648);
                                    jur_Lexer_nextIndex($this);
                                    break b;
                                case 63:
                                    $this.$lookAhead0 = $this.$lookAhead0 | (-1073741824);
                                    jur_Lexer_nextIndex($this);
                                    break b;
                                default:
                            }
                            $this.$lookAhead0 = $this.$lookAhead0 | (-536870912);
                            break b;
                        case 46:
                            $this.$lookAhead0 = (-536870866);
                            break b;
                        case 91:
                            $this.$lookAhead0 = (-536870821);
                            $this.$setMode(2);
                            break b;
                        case 93:
                            if ($this.$mode0 != 2)
                                break b;
                            $this.$lookAhead0 = (-536870819);
                            break b;
                        case 94:
                            $this.$lookAhead0 = (-536870818);
                            break b;
                        case 123:
                            $this.$lookAheadST = jur_Lexer_processQuantifier($this, $this.$lookAhead0);
                            break b;
                        case 124:
                            $this.$lookAhead0 = (-536870788);
                            break b;
                        default:
                    }
                else if ($this.$mode0 == 2)
                    switch ($this.$lookAhead0) {
                        case 38:
                            $this.$lookAhead0 = (-536870874);
                            break b;
                        case 45:
                            $this.$lookAhead0 = (-536870867);
                            break b;
                        case 91:
                            $this.$lookAhead0 = (-536870821);
                            break b;
                        case 93:
                            $this.$lookAhead0 = (-536870819);
                            break b;
                        case 94:
                            $this.$lookAhead0 = (-536870818);
                            break b;
                        default:
                    }
            }
            if ($reread)
                continue;
            else
                break;
        }
        return;
    }
    $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
},
jur_Lexer_parseCharClassName = $this => {
    let $sb, var$2, var$3, $ch, $res;
    $sb = jl_StringBuilder__init_0(10);
    if ($this.$index < ($this.$pattern0.data.length - 2 | 0)) {
        if ($this.$pattern0.data[$this.$index] != 123) {
            var$2 = jl_String__init_1($this.$pattern0, jur_Lexer_nextIndex($this), 1);
            var$3 = jl_StringBuilder__init_();
            jl_StringBuilder_append(jl_StringBuilder_append(var$3, $rt_s(290)), var$2);
            return jl_StringBuilder_toString(var$3);
        }
        jur_Lexer_nextIndex($this);
        $ch = 0;
        a: {
            while ($this.$index < ($this.$pattern0.data.length - 2 | 0)) {
                $ch = $this.$pattern0.data[jur_Lexer_nextIndex($this)];
                if ($ch == 125)
                    break a;
                $sb.$append0($ch);
            }
        }
        if ($ch != 125)
            $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
    }
    if (!$sb.$length())
        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
    $res = $sb.$toString();
    if ($res.$length() == 1) {
        var$2 = jl_StringBuilder__init_();
        jl_StringBuilder_append(jl_StringBuilder_append(var$2, $rt_s(290)), $res);
        return jl_StringBuilder_toString(var$2);
    }
    b: {
        c: {
            if ($res.$length() > 3) {
                if ($res.$startsWith1($rt_s(290)))
                    break c;
                if ($res.$startsWith1($rt_s(291)))
                    break c;
            }
            break b;
        }
        $res = $res.$substring0(2);
    }
    return $res;
},
jur_Lexer_processQuantifier = ($this, $ch) => {
    let $sb, $min, $max, $mod, $$je;
    $sb = jl_StringBuilder__init_0(4);
    $min = (-1);
    $max = 2147483647;
    a: {
        while (true) {
            if ($this.$index >= $this.$pattern0.data.length)
                break a;
            $ch = $this.$pattern0.data[jur_Lexer_nextIndex($this)];
            if ($ch == 125)
                break a;
            if ($ch == 44 && $min < 0)
                try {
                    $min = jl_Integer_parseInt($sb.$toString(), 10);
                    $sb.$delete0(0, $sb.$length());
                    continue;
                } catch ($$e) {
                    $$je = $rt_wrapException($$e);
                    if ($$je instanceof jl_NumberFormatException) {
                        break;
                    } else {
                        throw $$e;
                    }
                }
            $sb.$append0($ch & 65535);
        }
        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
    }
    if ($ch != 125)
        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
    if ($sb.$length() > 0)
        b: {
            try {
                $max = jl_Integer_parseInt($sb.$toString(), 10);
                if ($min >= 0)
                    break b;
                $min = $max;
                break b;
            } catch ($$e) {
                $$je = $rt_wrapException($$e);
                if ($$je instanceof jl_NumberFormatException) {
                    $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
                } else {
                    throw $$e;
                }
            }
        }
    else if ($min < 0)
        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
    if (($min | $max | ($max - $min | 0)) < 0)
        $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
    $mod = $this.$index >= $this.$pattern0.data.length ? 42 : $this.$pattern0.data[$this.$index];
    c: {
        switch ($mod) {
            case 43:
                $this.$lookAhead0 = (-2147483525);
                jur_Lexer_nextIndex($this);
                break c;
            case 63:
                $this.$lookAhead0 = (-1073741701);
                jur_Lexer_nextIndex($this);
                break c;
            default:
        }
        $this.$lookAhead0 = (-536870789);
    }
    return jur_Quantifier__init_0($min, $max);
},
jur_Lexer_toString = $this => {
    return $this.$orig;
},
jur_Lexer_isEmpty = $this => {
    return !$this.$ch && !$this.$lookAhead0 && $this.$index == $this.$patternFullLength && !$this.$isSpecial() ? 1 : 0;
},
jur_Lexer_isLetter = $ch => {
    return $ch < 0 ? 0 : 1;
},
jur_Lexer_isLetter0 = $this => {
    return !$this.$isEmpty() && !$this.$isSpecial() && jur_Lexer_isLetter($this.$ch) ? 1 : 0;
},
jur_Lexer_isHighSurrogate0 = $this => {
    return $this.$ch <= 56319 && $this.$ch >= 55296 ? 1 : 0;
},
jur_Lexer_isLowSurrogate0 = $this => {
    return $this.$ch <= 57343 && $this.$ch >= 56320 ? 1 : 0;
},
jur_Lexer_isHighSurrogate = $ch => {
    return $ch <= 56319 && $ch >= 55296 ? 1 : 0;
},
jur_Lexer_isLowSurrogate = $ch => {
    return $ch <= 57343 && $ch >= 56320 ? 1 : 0;
},
jur_Lexer_readHex = ($this, $max) => {
    let $st, $length, $i, var$5, $$je;
    $st = jl_StringBuilder__init_0($max);
    $length = $this.$pattern0.data.length - 2 | 0;
    $i = 0;
    while (true) {
        var$5 = $rt_compare($i, $max);
        if (var$5 >= 0)
            break;
        if ($this.$index >= $length)
            break;
        $st.$append0($this.$pattern0.data[jur_Lexer_nextIndex($this)]);
        $i = $i + 1 | 0;
    }
    if (!var$5)
        a: {
            try {
                var$5 = jl_Integer_parseInt($st.$toString(), 16);
            } catch ($$e) {
                $$je = $rt_wrapException($$e);
                if ($$je instanceof jl_NumberFormatException) {
                    break a;
                } else {
                    throw $$e;
                }
            }
            return var$5;
        }
    $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
},
jur_Lexer_readOctals = $this => {
    let $max, $i, $length, $res, var$5;
    $max = 3;
    $i = 1;
    $length = $this.$pattern0.data.length - 2 | 0;
    $res = jl_Character_digit($this.$pattern0.data[$this.$index], 8);
    switch ($res) {
        case -1:
            break;
        default:
            if ($res > 3)
                $max = 2;
            jur_Lexer_nextIndex($this);
            a: {
                while (true) {
                    if ($i >= $max)
                        break a;
                    if ($this.$index >= $length)
                        break a;
                    var$5 = jl_Character_digit($this.$pattern0.data[$this.$index], 8);
                    if (var$5 < 0)
                        break;
                    $res = ($res * 8 | 0) + var$5 | 0;
                    jur_Lexer_nextIndex($this);
                    $i = $i + 1 | 0;
                }
            }
            return $res;
    }
    $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
},
jur_Lexer_readFlags = $this => {
    let $pos, $res, $ch;
    $pos = 1;
    $res = $this.$flags0;
    a: while (true) {
        if ($this.$index >= $this.$pattern0.data.length)
            $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
        b: {
            c: {
                $ch = $this.$pattern0.data[$this.$index];
                switch ($ch) {
                    case 41:
                        jur_Lexer_nextIndex($this);
                        return $res | 256;
                    case 45:
                        if (!$pos)
                            $rt_throw(jur_PatternSyntaxException__init_($rt_s(3), $this.$toString(), $this.$index));
                        $pos = 0;
                        break b;
                    case 58:
                        break a;
                    case 100:
                        break c;
                    case 105:
                        $res = $pos ? $res | 2 : ($res ^ 2) & $res;
                        break b;
                    case 109:
                        $res = $pos ? $res | 8 : ($res ^ 8) & $res;
                        break b;
                    case 115:
                        $res = $pos ? $res | 32 : ($res ^ 32) & $res;
                        break b;
                    case 117:
                        $res = $pos ? $res | 64 : ($res ^ 64) & $res;
                        break b;
                    case 120:
                        $res = $pos ? $res | 4 : ($res ^ 4) & $res;
                        break b;
                    default:
                }
                break b;
            }
            $res = $pos ? $res | 1 : ($res ^ 1) & $res;
        }
        jur_Lexer_nextIndex($this);
    }
    jur_Lexer_nextIndex($this);
    return $res;
},
jur_Lexer_nextIndex = $this => {
    $this.$prevNW = $this.$index;
    if ($this.$flags0 & 4)
        jur_Lexer_skipComments($this);
    else
        $this.$index = $this.$index + 1 | 0;
    return $this.$prevNW;
},
jur_Lexer_skipComments = $this => {
    let $length;
    $length = $this.$pattern0.data.length - 2 | 0;
    $this.$index = $this.$index + 1 | 0;
    a: while (true) {
        if ($this.$index < $length && jl_Character_isWhitespace0($this.$pattern0.data[$this.$index])) {
            $this.$index = $this.$index + 1 | 0;
            continue;
        }
        if ($this.$index >= $length)
            break;
        if ($this.$pattern0.data[$this.$index] != 35)
            break;
        $this.$index = $this.$index + 1 | 0;
        while (true) {
            if ($this.$index >= $length)
                continue a;
            if (jur_Lexer_isLineSeparator($this, $this.$pattern0.data[$this.$index]))
                continue a;
            $this.$index = $this.$index + 1 | 0;
        }
    }
    return $this.$index;
},
jur_Lexer_isLineSeparator = ($this, $ch) => {
    return $ch != 10 && $ch != 13 && $ch != 133 && ($ch | 1) != 8233 ? 0 : 1;
},
jur_Lexer_getDecomposition = $ch => {
    return jur_Lexer_decompTable.$get5($ch);
},
jur_Lexer_getHangulDecomposition = $ch => {
    let $sIndex, $l, $v, $t, $decomp, var$7;
    $sIndex = $ch - 44032 | 0;
    if ($sIndex >= 0 && $sIndex < 11172) {
        $l = 4352 + ($sIndex / 588 | 0) | 0;
        $v = 4449 + (($sIndex % 588 | 0) / 28 | 0) | 0;
        $t = $sIndex % 28 | 0;
        if (!$t)
            $decomp = $rt_createIntArrayFromData([$l, $v]);
        else {
            var$7 = 4519 + $t | 0;
            $decomp = $rt_createIntArrayFromData([$l, $v, var$7]);
        }
        return $decomp;
    }
    return null;
},
jur_Lexer_hasSingleCodepointDecomposition = $ch => {
    let $hasSingleDecomp;
    $hasSingleDecomp = jur_Lexer_singleDecompTable.$get2($ch);
    return $hasSingleDecomp == jur_Lexer_singleDecompTableSize ? 0 : 1;
},
jur_Lexer_hasDecompositionNonNullCanClass = $ch => {
    return ($ch != 832 ? 0 : 1) | ($ch != 833 ? 0 : 1) | ($ch != 835 ? 0 : 1) | ($ch != 836 ? 0 : 1);
},
jur_Lexer_nextCodePoint = $this => {
    let $high, $lowExpectedIndex, $low;
    $high = $this.$pattern0.data[jur_Lexer_nextIndex($this)];
    if (jl_Character_isHighSurrogate($high)) {
        $lowExpectedIndex = $this.$prevNW + 1 | 0;
        if ($lowExpectedIndex < $this.$pattern0.data.length) {
            $low = $this.$pattern0.data[$lowExpectedIndex];
            if (jl_Character_isLowSurrogate($low)) {
                jur_Lexer_nextIndex($this);
                return jl_Character_toCodePoint($high, $low);
            }
        }
    }
    return $high;
},
jur_Lexer_getIndex = $this => {
    return $this.$curToc;
};
function ju_WeakHashMap() {
    let a = this; ju_AbstractMap.call(a);
    a.$referenceQueue = null;
    a.$elementCount0 = 0;
    a.$elementData0 = null;
    a.$loadFactor = 0;
    a.$threshold0 = 0;
    a.$modCount1 = 0;
}
let ju_WeakHashMap_newEntryArray = $size => {
    return $rt_createArray(ju_WeakHashMap$Entry, $size);
},
ju_WeakHashMap__init_0 = $this => {
    ju_WeakHashMap__init_($this, 16);
},
ju_WeakHashMap__init_1 = () => {
    let var_0 = new ju_WeakHashMap();
    ju_WeakHashMap__init_0(var_0);
    return var_0;
},
ju_WeakHashMap__init_ = ($this, $capacity) => {
    ju_AbstractMap__init_($this);
    if ($capacity < 0)
        $rt_throw(jl_IllegalArgumentException__init_());
    $this.$elementCount0 = 0;
    if (!$capacity)
        $capacity = 1;
    $this.$elementData0 = ju_WeakHashMap_newEntryArray($capacity);
    $this.$loadFactor = 7500;
    ju_WeakHashMap_computeMaxSize($this);
    $this.$referenceQueue = jlr_ReferenceQueue__init_0();
},
ju_WeakHashMap__init_2 = var_0 => {
    let var_1 = new ju_WeakHashMap();
    ju_WeakHashMap__init_(var_1, var_0);
    return var_1;
},
ju_WeakHashMap_computeMaxSize = $this => {
    $this.$threshold0 = Long_lo(Long_div(Long_mul(Long_fromInt($this.$elementData0.data.length), Long_fromInt($this.$loadFactor)), Long_fromInt(10000)));
},
ju_WeakHashMap_get = ($this, $key) => {
    let $entry, $index;
    ju_WeakHashMap_poll($this);
    if ($key === null) {
        $entry = $this.$elementData0.data[0];
        while ($entry !== null) {
            if ($entry.$isNull)
                return $entry.$value0;
            $entry = $entry.$next5;
        }
        return null;
    }
    $index = ($key.$hashCode() & 2147483647) % $this.$elementData0.data.length | 0;
    $entry = $this.$elementData0.data[$index];
    while ($entry !== null) {
        if ($key.$equals($entry.$get3()))
            return $entry.$value0;
        $entry = $entry.$next5;
    }
    return null;
},
ju_WeakHashMap_isEmpty = $this => {
    return $this.$size() ? 0 : 1;
},
ju_WeakHashMap_poll = $this => {
    let var$1;
    while (true) {
        var$1 = $this.$referenceQueue.$poll0();
        if (var$1 === null)
            break;
        ju_WeakHashMap_removeEntry($this, var$1);
    }
},
ju_WeakHashMap_removeEntry = ($this, $toRemove) => {
    let $last, $index, $entry, $entry_0;
    $last = null;
    $index = ($toRemove.$hash & 2147483647) % $this.$elementData0.data.length | 0;
    $entry = $this.$elementData0.data[$index];
    a: {
        while (true) {
            if ($entry === null)
                break a;
            if ($toRemove === $entry)
                break;
            $entry_0 = $entry.$next5;
            $last = $entry;
            $entry = $entry_0;
        }
        $this.$modCount1 = $this.$modCount1 + 1 | 0;
        if ($last !== null)
            $last.$next5 = $entry.$next5;
        else
            $this.$elementData0.data[$index] = $entry.$next5;
        $this.$elementCount0 = $this.$elementCount0 - 1 | 0;
    }
},
ju_WeakHashMap_put = ($this, $key, $value) => {
    let $index, $entry, $result, var$6, var$7;
    a: {
        ju_WeakHashMap_poll($this);
        $index = 0;
        if ($key === null) {
            $entry = $this.$elementData0.data[0];
            while ($entry !== null) {
                if ($entry.$isNull)
                    break a;
                $entry = $entry.$next5;
            }
        } else {
            $index = ($key.$hashCode() & 2147483647) % $this.$elementData0.data.length | 0;
            $entry = $this.$elementData0.data[$index];
            while ($entry !== null) {
                if ($key.$equals($entry.$get3()))
                    break a;
                $entry = $entry.$next5;
            }
        }
    }
    if ($entry !== null) {
        $result = $entry.$value0;
        $entry.$value0 = $value;
        return $result;
    }
    $this.$modCount1 = $this.$modCount1 + 1 | 0;
    var$6 = $this.$elementCount0 + 1 | 0;
    $this.$elementCount0 = var$6;
    if (var$6 > $this.$threshold0) {
        ju_WeakHashMap_rehash($this);
        $index = $key === null ? 0 : ($key.$hashCode() & 2147483647) % $this.$elementData0.data.length | 0;
    }
    var$7 = ju_WeakHashMap$Entry__init_0($key, $value, $this.$referenceQueue);
    var$7.$next5 = $this.$elementData0.data[$index];
    $this.$elementData0.data[$index] = var$7;
    return null;
},
ju_WeakHashMap_rehash = $this => {
    let $length, $newData, var$3, var$4, var$5, $entry, $index, var$8, $entry_0;
    $length = $this.$elementData0.data.length << 1;
    if (!$length)
        $length = 1;
    $newData = ju_WeakHashMap_newEntryArray($length);
    var$3 = $this.$elementData0.data;
    var$4 = var$3.length;
    var$5 = 0;
    while (var$5 < var$4) {
        $entry = var$3[var$5];
        while ($entry !== null) {
            $index = $entry.$isNull ? 0 : ($entry.$hash & 2147483647) % $length | 0;
            var$8 = $newData.data;
            $entry_0 = $entry.$next5;
            $entry.$next5 = var$8[$index];
            var$8[$index] = $entry;
            $entry = $entry_0;
        }
        var$5 = var$5 + 1 | 0;
    }
    $this.$elementData0 = $newData;
    ju_WeakHashMap_computeMaxSize($this);
},
ju_WeakHashMap_size = $this => {
    ju_WeakHashMap_poll($this);
    return $this.$elementCount0;
},
jur_AbstractCharClass$LazySpecialsBlock = $rt_classWithoutFields(jur_AbstractCharClass$LazyCharClass),
jur_AbstractCharClass$LazySpecialsBlock__init_ = $this => {
    jur_AbstractCharClass$LazyCharClass__init_($this);
},
jur_AbstractCharClass$LazySpecialsBlock__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazySpecialsBlock();
    jur_AbstractCharClass$LazySpecialsBlock__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazySpecialsBlock_computeValue = $this => {
    return ((jur_CharClass__init_()).$add1(65279, 65279)).$add1(65520, 65533);
},
jur_AbstractCharClass$LazyNonSpace = $rt_classWithoutFields(jur_AbstractCharClass$LazySpace),
jur_AbstractCharClass$LazyNonSpace__init_ = $this => {
    jur_AbstractCharClass$LazySpace__init_($this);
},
jur_AbstractCharClass$LazyNonSpace__init_0 = () => {
    let var_0 = new jur_AbstractCharClass$LazyNonSpace();
    jur_AbstractCharClass$LazyNonSpace__init_(var_0);
    return var_0;
},
jur_AbstractCharClass$LazyNonSpace_computeValue = $this => {
    let $chCl;
    $chCl = (jur_AbstractCharClass$LazySpace_computeValue($this)).$setNegative(1);
    $chCl.$mayContainSupplCodepoints0 = 1;
    return $chCl;
};
function otci_CharFlow() {
    let a = this; jl_Object.call(a);
    a.$characters = null;
    a.$pointer = 0;
}
let otci_CharFlow__init_ = ($this, $characters) => {
    jl_Object__init_($this);
    $this.$characters = $characters;
},
otci_CharFlow__init_0 = var_0 => {
    let var_1 = new otci_CharFlow();
    otci_CharFlow__init_(var_1, var_0);
    return var_1;
};
function jur_RangeSet() {
    let a = this; jur_LeafSet.call(a);
    a.$chars0 = null;
    a.$alt1 = 0;
}
let jur_RangeSet__init_ = ($this, $cc) => {
    jur_LeafSet__init_($this);
    $this.$chars0 = $cc.$getInstance();
    $this.$alt1 = $cc.$alt;
},
jur_RangeSet__init_0 = var_0 => {
    let var_1 = new jur_RangeSet();
    jur_RangeSet__init_(var_1, var_0);
    return var_1;
},
jur_RangeSet_accepts = ($this, $strIndex, $testString) => {
    return !$this.$chars0.$contains0($testString.$charAt($strIndex)) ? (-1) : 1;
},
jur_RangeSet_first = ($this, $set) => {
    if ($set instanceof jur_CharSet)
        return jur_AbstractCharClass_intersects0($this.$chars0, $set.$getChar());
    if ($set instanceof jur_RangeSet)
        return jur_AbstractCharClass_intersects($this.$chars0, $set.$chars0);
    if ($set instanceof jur_SupplRangeSet)
        return jur_AbstractCharClass_intersects($this.$chars0, $set.$getChars());
    if (!($set instanceof jur_SupplCharSet))
        return 1;
    return 0;
},
jur_RangeSet_getChars = $this => {
    return $this.$chars0;
};
function jur_UnicodeCategory() {
    jur_AbstractCharClass.call(this);
    this.$category = 0;
}
let jur_UnicodeCategory__init_ = ($this, $category) => {
    jur_AbstractCharClass__init_($this);
    $this.$category = $category;
},
jur_UnicodeCategory__init_0 = var_0 => {
    let var_1 = new jur_UnicodeCategory();
    jur_UnicodeCategory__init_(var_1, var_0);
    return var_1;
},
jur_UnicodeCategory_contains = ($this, $ch) => {
    return $this.$alt ^ ($this.$category != jl_Character_getType0($ch & 65535) ? 0 : 1);
},
jur_UnicodeCategoryScope = $rt_classWithoutFields(jur_UnicodeCategory),
jur_UnicodeCategoryScope__init_ = ($this, $category) => {
    jur_UnicodeCategory__init_($this, $category);
},
jur_UnicodeCategoryScope__init_0 = var_0 => {
    let var_1 = new jur_UnicodeCategoryScope();
    jur_UnicodeCategoryScope__init_(var_1, var_0);
    return var_1;
},
jur_UnicodeCategoryScope_contains = ($this, $ch) => {
    return $this.$alt ^ (!($this.$category >> jl_Character_getType0($ch & 65535) & 1) ? 0 : 1);
};
function jur_CharClass() {
    let a = this; jur_AbstractCharClass.call(a);
    a.$ci = 0;
    a.$uci = 0;
    a.$hasUCI0 = 0;
    a.$invertedSurrogates = 0;
    a.$inverted = 0;
    a.$hideBits = 0;
    a.$bits = null;
    a.$nonBitSet = null;
}
let jur_CharClass__init_2 = $this => {
    jur_AbstractCharClass__init_($this);
    $this.$bits = ju_BitSet__init_1();
},
jur_CharClass__init_ = () => {
    let var_0 = new jur_CharClass();
    jur_CharClass__init_2(var_0);
    return var_0;
},
jur_CharClass__init_0 = ($this, $ci, $uci) => {
    jur_AbstractCharClass__init_($this);
    $this.$bits = ju_BitSet__init_1();
    $this.$ci = $ci;
    $this.$uci = $uci;
},
jur_CharClass__init_4 = (var_0, var_1) => {
    let var_2 = new jur_CharClass();
    jur_CharClass__init_0(var_2, var_0, var_1);
    return var_2;
},
jur_CharClass__init_1 = ($this, $negative, $ci, $uci) => {
    jur_CharClass__init_0($this, $ci, $uci);
    $this.$setNegative($negative);
},
jur_CharClass__init_3 = (var_0, var_1, var_2) => {
    let var_3 = new jur_CharClass();
    jur_CharClass__init_1(var_3, var_0, var_1, var_2);
    return var_3;
},
jur_CharClass_add = ($this, $ch) => {
    a: {
        if ($this.$ci) {
            b: {
                if (!($ch >= 97 && $ch <= 122)) {
                    if ($ch < 65)
                        break b;
                    if ($ch > 90)
                        break b;
                }
                if ($this.$inverted) {
                    $this.$bits.$clear0(jur_Pattern_getSupplement($ch & 65535));
                    break a;
                }
                $this.$bits.$set1(jur_Pattern_getSupplement($ch & 65535));
                break a;
            }
            if ($this.$uci && $ch > 128) {
                $this.$hasUCI0 = 1;
                $ch = jl_Character_toLowerCase0(jl_Character_toUpperCase0($ch));
            }
        }
    }
    if (!(!jur_Lexer_isHighSurrogate($ch) && !jur_Lexer_isLowSurrogate($ch))) {
        if ($this.$invertedSurrogates)
            $this.$lowHighSurrogates.$clear0($ch - 55296 | 0);
        else
            $this.$lowHighSurrogates.$set1($ch - 55296 | 0);
    }
    if ($this.$inverted)
        $this.$bits.$clear0($ch);
    else
        $this.$bits.$set1($ch);
    if (!$this.$mayContainSupplCodepoints0 && jl_Character_isSupplementaryCodePoint($ch))
        $this.$mayContainSupplCodepoints0 = 1;
    return $this;
},
jur_CharClass_add1 = ($this, $cc) => {
    let $curAlt, $nb;
    if (!$this.$mayContainSupplCodepoints0 && $cc.$mayContainSupplCodepoints0)
        $this.$mayContainSupplCodepoints0 = 1;
    if ($this.$invertedSurrogates) {
        if (!$cc.$altSurrogates)
            $this.$lowHighSurrogates.$andNot($cc.$getLowHighSurrogates());
        else
            $this.$lowHighSurrogates.$and($cc.$getLowHighSurrogates());
    } else if (!$cc.$altSurrogates)
        $this.$lowHighSurrogates.$or($cc.$getLowHighSurrogates());
    else {
        $this.$lowHighSurrogates.$xor($cc.$getLowHighSurrogates());
        $this.$lowHighSurrogates.$and($cc.$getLowHighSurrogates());
        $this.$altSurrogates = $this.$altSurrogates ? 0 : 1;
        $this.$invertedSurrogates = 1;
    }
    if (!$this.$hideBits && $cc.$getBits() !== null) {
        if ($this.$inverted) {
            if (!$cc.$isNegative())
                $this.$bits.$andNot($cc.$getBits());
            else
                $this.$bits.$and($cc.$getBits());
        } else if (!$cc.$isNegative())
            $this.$bits.$or($cc.$getBits());
        else {
            $this.$bits.$xor($cc.$getBits());
            $this.$bits.$and($cc.$getBits());
            $this.$alt = $this.$alt ? 0 : 1;
            $this.$inverted = 1;
        }
    } else {
        $curAlt = $this.$alt;
        if ($this.$nonBitSet !== null) {
            $nb = $this.$nonBitSet;
            if (!$curAlt)
                $this.$nonBitSet = jur_CharClass$5__init_0($this, $curAlt, $nb, $cc);
            else
                $this.$nonBitSet = jur_CharClass$4__init_0($this, $curAlt, $nb, $cc);
        } else {
            if ($curAlt && !$this.$inverted && $this.$bits.$isEmpty())
                $this.$nonBitSet = jur_CharClass$1__init_0($this, $cc);
            else if (!$curAlt)
                $this.$nonBitSet = jur_CharClass$3__init_0($this, $curAlt, $cc);
            else
                $this.$nonBitSet = jur_CharClass$2__init_0($this, $curAlt, $cc);
            $this.$hideBits = 1;
        }
    }
    return $this;
},
jur_CharClass_add0 = ($this, $i, $end) => {
    if ($i > $end)
        $rt_throw(jl_IllegalArgumentException__init_());
    a: {
        b: {
            if (!$this.$ci) {
                if ($end < 55296)
                    break b;
                if ($i > 57343)
                    break b;
            }
            while (true) {
                if ($i >= ($end + 1 | 0))
                    break a;
                $this.$add0($i);
                $i = $i + 1 | 0;
            }
        }
        if ($this.$inverted)
            $this.$bits.$clear1($i, $end + 1 | 0);
        else
            $this.$bits.$set($i, $end + 1 | 0);
    }
    return $this;
},
jur_CharClass_union = ($this, $clazz) => {
    let $curAlt, $nb;
    if (!$this.$mayContainSupplCodepoints0 && $clazz.$mayContainSupplCodepoints0)
        $this.$mayContainSupplCodepoints0 = 1;
    if ($clazz.$hasUCI())
        $this.$hasUCI0 = 1;
    if (!($this.$altSurrogates ^ $clazz.$altSurrogates)) {
        if (!$this.$altSurrogates)
            $this.$lowHighSurrogates.$or($clazz.$getLowHighSurrogates());
        else
            $this.$lowHighSurrogates.$and($clazz.$getLowHighSurrogates());
    } else if ($this.$altSurrogates)
        $this.$lowHighSurrogates.$andNot($clazz.$getLowHighSurrogates());
    else {
        $this.$lowHighSurrogates.$xor($clazz.$getLowHighSurrogates());
        $this.$lowHighSurrogates.$and($clazz.$getLowHighSurrogates());
        $this.$altSurrogates = 1;
    }
    if (!$this.$hideBits && $clazz.$getBits() !== null) {
        if (!($this.$alt ^ $clazz.$isNegative())) {
            if (!$this.$alt)
                $this.$bits.$or($clazz.$getBits());
            else
                $this.$bits.$and($clazz.$getBits());
        } else if ($this.$alt)
            $this.$bits.$andNot($clazz.$getBits());
        else {
            $this.$bits.$xor($clazz.$getBits());
            $this.$bits.$and($clazz.$getBits());
            $this.$alt = 1;
        }
    } else {
        $curAlt = $this.$alt;
        if ($this.$nonBitSet !== null) {
            $nb = $this.$nonBitSet;
            if (!$curAlt)
                $this.$nonBitSet = jur_CharClass$11__init_0($this, $curAlt, $nb, $clazz);
            else
                $this.$nonBitSet = jur_CharClass$10__init_0($this, $curAlt, $nb, $clazz);
        } else {
            if (!$this.$inverted && $this.$bits.$isEmpty()) {
                if (!$curAlt)
                    $this.$nonBitSet = jur_CharClass$7__init_0($this, $clazz);
                else
                    $this.$nonBitSet = jur_CharClass$6__init_0($this, $clazz);
            } else if (!$curAlt)
                $this.$nonBitSet = jur_CharClass$9__init_0($this, $clazz, $curAlt);
            else
                $this.$nonBitSet = jur_CharClass$8__init_0($this, $clazz, $curAlt);
            $this.$hideBits = 1;
        }
    }
},
jur_CharClass_intersection = ($this, $clazz) => {
    let $curAlt, $nb;
    if (!$this.$mayContainSupplCodepoints0 && $clazz.$mayContainSupplCodepoints0)
        $this.$mayContainSupplCodepoints0 = 1;
    if ($clazz.$hasUCI())
        $this.$hasUCI0 = 1;
    if (!($this.$altSurrogates ^ $clazz.$altSurrogates)) {
        if (!$this.$altSurrogates)
            $this.$lowHighSurrogates.$and($clazz.$getLowHighSurrogates());
        else
            $this.$lowHighSurrogates.$or($clazz.$getLowHighSurrogates());
    } else if (!$this.$altSurrogates)
        $this.$lowHighSurrogates.$andNot($clazz.$getLowHighSurrogates());
    else {
        $this.$lowHighSurrogates.$xor($clazz.$getLowHighSurrogates());
        $this.$lowHighSurrogates.$and($clazz.$getLowHighSurrogates());
        $this.$altSurrogates = 0;
    }
    if (!$this.$hideBits && $clazz.$getBits() !== null) {
        if (!($this.$alt ^ $clazz.$isNegative())) {
            if (!$this.$alt)
                $this.$bits.$and($clazz.$getBits());
            else
                $this.$bits.$or($clazz.$getBits());
        } else if (!$this.$alt)
            $this.$bits.$andNot($clazz.$getBits());
        else {
            $this.$bits.$xor($clazz.$getBits());
            $this.$bits.$and($clazz.$getBits());
            $this.$alt = 0;
        }
    } else {
        $curAlt = $this.$alt;
        if ($this.$nonBitSet !== null) {
            $nb = $this.$nonBitSet;
            if (!$curAlt)
                $this.$nonBitSet = jur_CharClass$17__init_0($this, $curAlt, $nb, $clazz);
            else
                $this.$nonBitSet = jur_CharClass$16__init_0($this, $curAlt, $nb, $clazz);
        } else {
            if (!$this.$inverted && $this.$bits.$isEmpty()) {
                if (!$curAlt)
                    $this.$nonBitSet = jur_CharClass$13__init_0($this, $clazz);
                else
                    $this.$nonBitSet = jur_CharClass$12__init_0($this, $clazz);
            } else if (!$curAlt)
                $this.$nonBitSet = jur_CharClass$15__init_0($this, $clazz, $curAlt);
            else
                $this.$nonBitSet = jur_CharClass$14__init_0($this, $clazz, $curAlt);
            $this.$hideBits = 1;
        }
    }
},
jur_CharClass_contains = ($this, $ch) => {
    if ($this.$nonBitSet !== null)
        return $this.$alt ^ $this.$nonBitSet.$contains0($ch);
    return $this.$alt ^ $this.$bits.$get1($ch);
},
jur_CharClass_getBits = $this => {
    if (!$this.$hideBits)
        return $this.$bits;
    return null;
},
jur_CharClass_getLowHighSurrogates = $this => {
    return $this.$lowHighSurrogates;
},
jur_CharClass_getInstance = $this => {
    let $bs, $res;
    if ($this.$nonBitSet !== null)
        return $this;
    $bs = $this.$getBits();
    $res = jur_CharClass$18__init_0($this, $bs);
    return $res.$setNegative($this.$isNegative());
},
jur_CharClass_toString = $this => {
    let $temp, $i;
    $temp = jl_StringBuilder__init_();
    $i = $this.$bits.$nextSetBit(0);
    while ($i >= 0) {
        $temp.$append4(jl_Character_toChars($i));
        $temp.$append0(124);
        $i = $this.$bits.$nextSetBit($i + 1 | 0);
    }
    if ($temp.$length() > 0)
        $temp.$deleteCharAt($temp.$length() - 1 | 0);
    return $temp.$toString();
},
jur_CharClass_hasUCI = $this => {
    return $this.$hasUCI0;
},
jur_UCIDecomposedCharSet = $rt_classWithoutFields(jur_DecomposedCharSet),
jur_UCIDecomposedCharSet__init_ = ($this, $decomp, $decomposedCharLength) => {
    jur_DecomposedCharSet__init_($this, $decomp, $decomposedCharLength);
},
jur_UCIDecomposedCharSet__init_0 = (var_0, var_1) => {
    let var_2 = new jur_UCIDecomposedCharSet();
    jur_UCIDecomposedCharSet__init_(var_2, var_0, var_1);
    return var_2;
},
otrr_ClassInfo = $rt_classWithoutFields(otrr_ReflectionInfo),
otrr_ClassInfo_newArrayInstance = (var$0, var$1) => {
    switch (var$0.primitiveKind) {
        default: return $rt_createArray(var$0, var$1);
    }
},
ju_HashMap$EntryIterator = $rt_classWithoutFields(ju_HashMap$AbstractMapIterator),
ju_HashMap$EntryIterator__init_ = (var$0, var$1) => {
    ju_HashMap$AbstractMapIterator__init_(var$0, var$1);
},
ju_HashMap$EntryIterator__init_0 = var_0 => {
    let var_1 = new ju_HashMap$EntryIterator();
    ju_HashMap$EntryIterator__init_(var_1, var_0);
    return var_1;
},
ju_HashMap$EntryIterator_next = $this => {
    ju_HashMap$AbstractMapIterator_makeNext($this);
    return $this.$currentEntry;
},
ju_HashMap$EntryIterator_next0 = $this => {
    return $this.$next1();
},
owtp_PyraminxSolver = $rt_classWithoutFields(),
owtp_PyraminxSolver_moveToString = null,
owtp_PyraminxSolver_inverseMoveToString = null,
owtp_PyraminxSolver_tipToString = null,
owtp_PyraminxSolver_inverseTipToString = null,
owtp_PyraminxSolver_fact = null,
owtp_PyraminxSolver_moveEdgePerm = null,
owtp_PyraminxSolver_moveEdgeOrient = null,
owtp_PyraminxSolver_moveCornerOrient = null,
owtp_PyraminxSolver_prunPerm = null,
owtp_PyraminxSolver_prunOrient = null,
owtp_PyraminxSolver_$assertionsDisabled = 0,
owtp_PyraminxSolver_$callClinit = () => {
    owtp_PyraminxSolver_$callClinit = $rt_eraseClinit(owtp_PyraminxSolver);
    owtp_PyraminxSolver__clinit_();
},
owtp_PyraminxSolver__init_ = $this => {
    owtp_PyraminxSolver_$callClinit();
    jl_Object__init_($this);
},
owtp_PyraminxSolver__init_0 = () => {
    let var_0 = new owtp_PyraminxSolver();
    owtp_PyraminxSolver__init_(var_0);
    return var_0;
},
owtp_PyraminxSolver_packEdgePerm = $edges => {
    let $idx, $val, $i, $v;
    owtp_PyraminxSolver_$callClinit();
    $idx = 0;
    $val = 5517840;
    $i = 0;
    while ($i < 5) {
        $v = ($edges.data[$i] & 7) << 2;
        $idx = $rt_imul(6 - $i | 0, $idx) + ($val >> $v & 7) | 0;
        $val = $val - (1118480 << $v) | 0;
        $i = $i + 1 | 0;
    }
    return $idx;
},
owtp_PyraminxSolver_unpackEdgePerm = ($perm, $edges) => {
    let $val, $i, var$5, $p, $v, var$8, $m;
    owtp_PyraminxSolver_$callClinit();
    $val = 5517840;
    $i = 0;
    while ($i < 5) {
        var$5 = $edges.data;
        $p = owtp_PyraminxSolver_fact.data[5 - $i | 0];
        $v = $perm / $p | 0;
        $perm = $perm - $rt_imul($v, $p) | 0;
        var$8 = $v << 2;
        var$5[$i] = $val >> var$8 & 7;
        $m = (1 << var$8) - 1 | 0;
        $val = ($val & $m) + ($val >> 4 & ($m ^ (-1))) | 0;
        $i = $i + 1 | 0;
    }
    $edges.data[5] = $val;
},
owtp_PyraminxSolver_packEdgeOrient = $edges => {
    let $ori, $i, var$4;
    owtp_PyraminxSolver_$callClinit();
    $ori = 0;
    $i = 0;
    while ($i < 5) {
        var$4 = $edges.data;
        $ori = (2 * $ori | 0) + (var$4[$i] >> 3) | 0;
        $i = $i + 1 | 0;
    }
    return $ori;
},
owtp_PyraminxSolver_unpackEdgeOrient = ($ori, $edges) => {
    let $sum_ori, $i, var$5, var$6;
    owtp_PyraminxSolver_$callClinit();
    $sum_ori = 0;
    $i = 4;
    while ($i >= 0) {
        var$5 = $edges.data;
        var$6 = $ori & 1;
        var$5[$i] = var$6 << 3;
        $sum_ori = $sum_ori ^ var$6;
        $ori = $ori >> 1;
        $i = $i + (-1) | 0;
    }
    $edges.data[5] = $sum_ori << 3;
},
owtp_PyraminxSolver_packCornerOrient = $corners => {
    let $ori, $i, var$4;
    owtp_PyraminxSolver_$callClinit();
    $ori = 0;
    $i = 0;
    while ($i < 4) {
        var$4 = $corners.data;
        $ori = (3 * $ori | 0) + var$4[$i] | 0;
        $i = $i + 1 | 0;
    }
    return $ori;
},
owtp_PyraminxSolver_unpackCornerOrient = ($ori, $corners) => {
    let $i;
    owtp_PyraminxSolver_$callClinit();
    $i = 3;
    while ($i >= 0) {
        $corners.data[$i] = $ori % 3 | 0;
        $ori = $ori / 3 | 0;
        $i = $i + (-1) | 0;
    }
},
owtp_PyraminxSolver_cycleAndOrient = ($edges, $a, $b, $c, $times) => {
    let var$6, $temp;
    owtp_PyraminxSolver_$callClinit();
    var$6 = $edges.data;
    $temp = var$6[$c];
    var$6[$c] = (var$6[$b] + 8 | 0) % 16 | 0;
    var$6[$b] = (var$6[$a] + 8 | 0) % 16 | 0;
    var$6[$a] = $temp;
    if ($times > 1)
        owtp_PyraminxSolver_cycleAndOrient($edges, $a, $b, $c, $times - 1 | 0);
},
owtp_PyraminxSolver_moveEdges = ($edges, $move) => {
    let $face, $times;
    owtp_PyraminxSolver_$callClinit();
    a: {
        $face = $move / 2 | 0;
        $times = ($move % 2 | 0) + 1 | 0;
        switch ($face) {
            case 0:
                break;
            case 1:
                owtp_PyraminxSolver_cycleAndOrient($edges, 2, 1, 0, $times);
                break a;
            case 2:
                owtp_PyraminxSolver_cycleAndOrient($edges, 0, 3, 4, $times);
                break a;
            case 3:
                owtp_PyraminxSolver_cycleAndOrient($edges, 2, 4, 5, $times);
                break a;
            default:
                if (owtp_PyraminxSolver_$assertionsDisabled)
                    break a;
                else
                    $rt_throw(jl_AssertionError__init_());
        }
        owtp_PyraminxSolver_cycleAndOrient($edges, 5, 3, 1, $times);
    }
};
let owtp_PyraminxSolver_moveCorners = ($corners, $move) => {
    let var$3, $face, $times;
    owtp_PyraminxSolver_$callClinit();
    var$3 = $corners.data;
    $face = $move / 2 | 0;
    $times = ($move % 2 | 0) + 1 | 0;
    var$3[$face] = (var$3[$face] + $times | 0) % 3 | 0;
},
owtp_PyraminxSolver_initMoves = () => {
    let $edges1, $edges2, $perm, $move, $newPerm, $orient, $newOrient, $corners1, $corners2;
    owtp_PyraminxSolver_$callClinit();
    $edges1 = $rt_createIntArray(6);
    $edges2 = $rt_createIntArray(6);
    $perm = 0;
    while ($perm < 720) {
        owtp_PyraminxSolver_unpackEdgePerm($perm, $edges1);
        $move = 0;
        while ($move < 8) {
            jl_System_fastArraycopy($edges1, 0, $edges2, 0, 6);
            owtp_PyraminxSolver_moveEdges($edges2, $move);
            $newPerm = owtp_PyraminxSolver_packEdgePerm($edges2);
            owtp_PyraminxSolver_moveEdgePerm.data[$perm].data[$move] = $newPerm;
            $move = $move + 1 | 0;
        }
        $perm = $perm + 1 | 0;
    }
    $orient = 0;
    while ($orient < 32) {
        owtp_PyraminxSolver_unpackEdgeOrient($orient, $edges1);
        $move = 0;
        while ($move < 8) {
            jl_System_fastArraycopy($edges1, 0, $edges2, 0, 6);
            owtp_PyraminxSolver_moveEdges($edges2, $move);
            $newOrient = owtp_PyraminxSolver_packEdgeOrient($edges2);
            owtp_PyraminxSolver_moveEdgeOrient.data[$orient].data[$move] = $newOrient;
            $move = $move + 1 | 0;
        }
        $orient = $orient + 1 | 0;
    }
    $corners1 = $rt_createIntArray(4);
    $corners2 = $rt_createIntArray(4);
    $orient = 0;
    while ($orient < 81) {
        owtp_PyraminxSolver_unpackCornerOrient($orient, $corners1);
        $move = 0;
        while ($move < 8) {
            jl_System_fastArraycopy($corners1, 0, $corners2, 0, 4);
            owtp_PyraminxSolver_moveCorners($corners2, $move);
            $newOrient = owtp_PyraminxSolver_packCornerOrient($corners2);
            owtp_PyraminxSolver_moveCornerOrient.data[$orient].data[$move] = $newOrient;
            $move = $move + 1 | 0;
        }
        $orient = $orient + 1 | 0;
    }
},
owtp_PyraminxSolver_initPrun = () => {
    let $perm, $done, $length, $move, $newPerm, $orient, var$7, $newEdgeOrient, $newCornerOrient, $newOrient;
    owtp_PyraminxSolver_$callClinit();
    $perm = 0;
    while ($perm < 720) {
        owtp_PyraminxSolver_prunPerm.data[$perm] = (-1);
        $perm = $perm + 1 | 0;
    }
    owtp_PyraminxSolver_prunPerm.data[0] = 0;
    $done = 1;
    $length = 0;
    while ($done < 360) {
        $perm = 0;
        while ($perm < 720) {
            if (owtp_PyraminxSolver_prunPerm.data[$perm] == $length) {
                $move = 0;
                while ($move < 8) {
                    $newPerm = owtp_PyraminxSolver_moveEdgePerm.data[$perm].data[$move];
                    if (owtp_PyraminxSolver_prunPerm.data[$newPerm] == (-1)) {
                        owtp_PyraminxSolver_prunPerm.data[$newPerm] = $length + 1 | 0;
                        $done = $done + 1 | 0;
                    }
                    $move = $move + 1 | 0;
                }
            }
            $perm = $perm + 1 | 0;
        }
        $length = $length + 1 | 0;
    }
    $orient = 0;
    while ($orient < 2592) {
        owtp_PyraminxSolver_prunOrient.data[$orient] = (-1);
        $orient = $orient + 1 | 0;
    }
    owtp_PyraminxSolver_prunOrient.data[0] = 0;
    var$7 = 1;
    $length = 0;
    while (var$7 < 2592) {
        $orient = 0;
        while ($orient < 2592) {
            if (owtp_PyraminxSolver_prunOrient.data[$orient] == $length) {
                $move = 0;
                while ($move < 8) {
                    $newEdgeOrient = owtp_PyraminxSolver_moveEdgeOrient.data[$orient % 32 | 0].data[$move];
                    $newCornerOrient = owtp_PyraminxSolver_moveCornerOrient.data[$orient / 32 | 0].data[$move];
                    $newOrient = ($newCornerOrient * 32 | 0) + $newEdgeOrient | 0;
                    if (owtp_PyraminxSolver_prunOrient.data[$newOrient] == (-1)) {
                        owtp_PyraminxSolver_prunOrient.data[$newOrient] = $length + 1 | 0;
                        var$7 = var$7 + 1 | 0;
                    }
                    $move = $move + 1 | 0;
                }
            }
            $orient = $orient + 1 | 0;
        }
        $length = $length + 1 | 0;
    }
},
owtp_PyraminxSolver_search = ($this, $edgePerm, $edgeOrient, $cornerOrient, $depth, $length, $last_move, $solution, $randomiseMoves) => {
    let $randomOffset, $move, $randomMove, $newEdgePerm, $newEdgeOrient, $newCornerOrient;
    if (!$length)
        return !$edgePerm && !$edgeOrient && !$cornerOrient ? 1 : 0;
    owtp_PyraminxSolver_$callClinit();
    if (owtp_PyraminxSolver_prunPerm.data[$edgePerm] <= $length && owtp_PyraminxSolver_prunOrient.data[($cornerOrient * 32 | 0) + $edgeOrient | 0] <= $length) {
        $randomOffset = $randomiseMoves.$nextInt(8);
        $move = 0;
        while ($move < 8) {
            $randomMove = ($move + $randomOffset | 0) % 8 | 0;
            if (($randomMove / 2 | 0) != ($last_move / 2 | 0)) {
                $newEdgePerm = owtp_PyraminxSolver_moveEdgePerm.data[$edgePerm].data[$randomMove];
                $newEdgeOrient = owtp_PyraminxSolver_moveEdgeOrient.data[$edgeOrient].data[$randomMove];
                $newCornerOrient = owtp_PyraminxSolver_moveCornerOrient.data[$cornerOrient].data[$randomMove];
                if (owtp_PyraminxSolver_search($this, $newEdgePerm, $newEdgeOrient, $newCornerOrient, $depth + 1 | 0, $length - 1 | 0, $randomMove, $solution, $randomiseMoves)) {
                    $solution.data[$depth] = $randomMove;
                    return 1;
                }
            }
            $move = $move + 1 | 0;
        }
        return 0;
    }
    return 0;
},
owtp_PyraminxSolver_randomState = ($this, $r) => {
    let $state;
    $state = owtp_PyraminxSolver$PyraminxSolverState__init_();
    while (true) {
        $state.$edgePerm = $r.$nextInt(720);
        owtp_PyraminxSolver_$callClinit();
        if (owtp_PyraminxSolver_prunPerm.data[$state.$edgePerm] == (-1))
            continue;
        else
            break;
    }
    $state.$edgeOrient = $r.$nextInt(32);
    $state.$cornerOrient = $r.$nextInt(81);
    $state.$tips = $r.$nextInt(81);
    return $state;
},
owtp_PyraminxSolver_solveIn = ($this, $state, $length, $includingTips) => {
    return owtp_PyraminxSolver_solve($this, $state, $length, 0, 0, $includingTips);
},
owtp_PyraminxSolver_generateExactly = ($this, $state, $length, $includingTips) => {
    return owtp_PyraminxSolver_solve($this, $state, $length, 1, 1, $includingTips);
},
owtp_PyraminxSolver_solve = ($this, $state, $desiredLength, $exactLength, $inverse, $includingTips) => {
    let $r, $solution, $foundSolution, $length, $scramble, $i, var$12, var$13, $arrayTips, $tip, $dir;
    $r = ju_Random__init_1();
    $solution = $rt_createIntArray(20);
    $foundSolution = 0;
    if ($includingTips)
        $desiredLength = $desiredLength - $state.$unsolvedTips() | 0;
    $length = !$exactLength ? 0 : $desiredLength;
    a: {
        while ($length <= $desiredLength) {
            if (owtp_PyraminxSolver_search($this, $state.$edgePerm, $state.$edgeOrient, $state.$cornerOrient, 0, $length, 42, $solution, $r)) {
                $foundSolution = 1;
                break a;
            }
            $length = $length + 1 | 0;
        }
    }
    if (!$foundSolution)
        return null;
    b: {
        $scramble = jl_StringBuilder__init_0(72);
        if (!$inverse) {
            $i = 0;
            while (true) {
                if ($i >= $length)
                    break b;
                var$12 = $solution.data;
                var$13 = $scramble.$append1($rt_s(16));
                owtp_PyraminxSolver_$callClinit();
                var$13.$append1(owtp_PyraminxSolver_moveToString.data[var$12[$i]]);
                $i = $i + 1 | 0;
            }
        }
        $i = $length - 1 | 0;
        while ($i >= 0) {
            var$12 = $solution.data;
            var$13 = $scramble.$append1($rt_s(16));
            owtp_PyraminxSolver_$callClinit();
            var$13.$append1(owtp_PyraminxSolver_inverseMoveToString.data[var$12[$i]]);
            $i = $i + (-1) | 0;
        }
    }
    $arrayTips = $rt_createIntArray(4);
    owtp_PyraminxSolver_unpackCornerOrient($state.$tips, $arrayTips);
    $tip = 0;
    while ($tip < 4) {
        $dir = $arrayTips.data[$tip];
        if ($dir > 0) {
            if (!$inverse)
                ($scramble.$append1($rt_s(16))).$append1(owtp_PyraminxSolver_inverseTipToString.data[(($tip * 2 | 0) + $dir | 0) - 1 | 0]);
            else
                ($scramble.$append1($rt_s(16))).$append1(owtp_PyraminxSolver_tipToString.data[(($tip * 2 | 0) + $dir | 0) - 1 | 0]);
        }
        $tip = $tip + 1 | 0;
    }
    return ($scramble.$toString()).$trim();
},
owtp_PyraminxSolver__clinit_ = () => {
    owtp_PyraminxSolver_$assertionsDisabled = jl_Class_desiredAssertionStatus($rt_cls(owtp_PyraminxSolver)) ? 0 : 1;
    owtp_PyraminxSolver_moveToString = $rt_wrapArray(jl_String, [$rt_s(17), $rt_s(19), $rt_s(222), $rt_s(238), $rt_s(20), $rt_s(22), $rt_s(228), $rt_s(241)]);
    owtp_PyraminxSolver_inverseMoveToString = $rt_wrapArray(jl_String, [$rt_s(19), $rt_s(17), $rt_s(238), $rt_s(222), $rt_s(22), $rt_s(20), $rt_s(241), $rt_s(228)]);
    owtp_PyraminxSolver_tipToString = $rt_wrapArray(jl_String, [$rt_s(292), $rt_s(293), $rt_s(294), $rt_s(295), $rt_s(296), $rt_s(297), $rt_s(298), $rt_s(299)]);
    owtp_PyraminxSolver_inverseTipToString = $rt_wrapArray(jl_String, [$rt_s(293), $rt_s(292), $rt_s(295), $rt_s(294), $rt_s(297), $rt_s(296), $rt_s(299), $rt_s(298)]);
    owtp_PyraminxSolver_fact = $rt_createIntArrayFromData([1, 1, 2, 6, 24, 120, 720]);
    owtp_PyraminxSolver_moveEdgePerm = $rt_createIntMultiArray([8, 720]);
    owtp_PyraminxSolver_moveEdgeOrient = $rt_createIntMultiArray([8, 32]);
    owtp_PyraminxSolver_moveCornerOrient = $rt_createIntMultiArray([8, 81]);
    owtp_PyraminxSolver_prunPerm = $rt_createIntArray(720);
    owtp_PyraminxSolver_prunOrient = $rt_createIntArray(2592);
    owtp_PyraminxSolver_initMoves();
    owtp_PyraminxSolver_initPrun();
},
owtp_CubePuzzle$Face = $rt_classWithoutFields(jl_Enum),
owtp_CubePuzzle$Face_R = null,
owtp_CubePuzzle$Face_U = null,
owtp_CubePuzzle$Face_F = null,
owtp_CubePuzzle$Face_L = null,
owtp_CubePuzzle$Face_D = null,
owtp_CubePuzzle$Face_B = null,
owtp_CubePuzzle$Face_$VALUES = null,
owtp_CubePuzzle$Face_$callClinit = () => {
    owtp_CubePuzzle$Face_$callClinit = $rt_eraseClinit(owtp_CubePuzzle$Face);
    owtp_CubePuzzle$Face__clinit_();
},
owtp_CubePuzzle$Face_values = () => {
    owtp_CubePuzzle$Face_$callClinit();
    return owtp_CubePuzzle$Face_$VALUES.$clone0();
},
owtp_CubePuzzle$Face_valueOf = $name => {
    owtp_CubePuzzle$Face_$callClinit();
    return jl_Enum_valueOf($rt_cls(owtp_CubePuzzle$Face), $name);
},
owtp_CubePuzzle$Face__init_0 = ($this, var$1, var$2) => {
    owtp_CubePuzzle$Face_$callClinit();
    jl_Enum__init_($this, var$1, var$2);
},
owtp_CubePuzzle$Face__init_ = (var_0, var_1) => {
    let var_2 = new owtp_CubePuzzle$Face();
    owtp_CubePuzzle$Face__init_0(var_2, var_0, var_1);
    return var_2;
},
owtp_CubePuzzle$Face_oppositeFace = $this => {
    return (owtp_CubePuzzle$Face_values()).data[(jl_Enum_ordinal($this) + 3 | 0) % 6 | 0];
},
owtp_CubePuzzle$Face__clinit_ = () => {
    let var$1, var$2;
    owtp_CubePuzzle$Face_R = owtp_CubePuzzle$Face__init_($rt_s(20), 0);
    owtp_CubePuzzle$Face_U = owtp_CubePuzzle$Face__init_($rt_s(17), 1);
    owtp_CubePuzzle$Face_F = owtp_CubePuzzle$Face__init_($rt_s(23), 2);
    owtp_CubePuzzle$Face_L = owtp_CubePuzzle$Face__init_($rt_s(222), 3);
    owtp_CubePuzzle$Face_D = owtp_CubePuzzle$Face__init_($rt_s(62), 4);
    owtp_CubePuzzle$Face_B = owtp_CubePuzzle$Face__init_($rt_s(228), 5);
    var$1 = $rt_createArray(owtp_CubePuzzle$Face, 6);
    var$2 = var$1.data;
    var$2[0] = owtp_CubePuzzle$Face_R;
    var$2[1] = owtp_CubePuzzle$Face_U;
    var$2[2] = owtp_CubePuzzle$Face_F;
    var$2[3] = owtp_CubePuzzle$Face_L;
    var$2[4] = owtp_CubePuzzle$Face_D;
    var$2[5] = owtp_CubePuzzle$Face_B;
    owtp_CubePuzzle$Face_$VALUES = var$1;
},
ju_Collections = $rt_classWithoutFields(),
ju_Collections_EMPTY_SET = null,
ju_Collections_EMPTY_MAP = null,
ju_Collections_EMPTY_LIST = null,
ju_Collections_EMPTY_ITERATOR = null,
ju_Collections_EMPTY_LIST_ITERATOR = null,
ju_Collections_reverseOrder = null,
ju_Collections_$callClinit = () => {
    ju_Collections_$callClinit = $rt_eraseClinit(ju_Collections);
    ju_Collections__clinit_();
},
ju_Collections_emptyMap = () => {
    ju_Collections_$callClinit();
    return ju_Collections_EMPTY_MAP;
},
ju_Collections_unmodifiableMap = $m => {
    ju_Collections_$callClinit();
    ju_Objects_requireNonNull($m);
    return ju_Collections$13__init_0($m);
},
ju_Collections__clinit_ = () => {
    ju_Collections_EMPTY_SET = ju_Collections$1__init_0();
    ju_Collections_EMPTY_MAP = ju_Collections$2__init_0();
    ju_Collections_EMPTY_LIST = ju_Collections$3__init_0();
    ju_Collections_EMPTY_ITERATOR = ju_Collections$4__init_0();
    ju_Collections_EMPTY_LIST_ITERATOR = ju_Collections$5__init_0();
    ju_Collections_reverseOrder = ju_Collections$_clinit_$lambda$_59_0__init_0();
};
$rt_packages([-1, "java", 0, "util", 1, "regex", 0, "lang", -1, "org", 4, "worldcubeassociation", 5, "tnoodle", 6, "puzzle", 6, "scrambles"
]);
$rt_metadata([jl_Object, "Object", 3, 0, [], 1, 0, 0, ["$isEmptyMonitor", $rt_wrapFunction0(jl_Object_isEmptyMonitor), "$getClass", $rt_wrapFunction0(jl_Object_getClass), "$hashCode", $rt_wrapFunction0(jl_Object_hashCode), "$equals", $rt_wrapFunction1(jl_Object_equals), "$toString", $rt_wrapFunction0(jl_Object_toString), "$identity", $rt_wrapFunction0(jl_Object_identity), "$clone0", $rt_wrapFunction0(jl_Object_clone)],
jur_AbstractCharClass$LazyCharClass, 0, jl_Object, [], 1024, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyCharClass__init_), "$getValue0", $rt_wrapFunction1(jur_AbstractCharClass$LazyCharClass_getValue)],
jur_AbstractCharClass$LazyBlank, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyBlank__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyBlank_computeValue)],
jur_AbstractCharClass$LazyCntrl, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyCntrl__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyCntrl_computeValue)],
jl_Throwable, 0, jl_Object, [], 1, 0, 0, ["$fillInStackTrace", $rt_wrapFunction0(jl_Throwable_fillInStackTrace), "$getMessage", $rt_wrapFunction0(jl_Throwable_getMessage), "$getCause", $rt_wrapFunction0(jl_Throwable_getCause)],
jl_Exception, 0, jl_Throwable, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_Exception__init_0), "$_init_3", $rt_wrapFunction2(jl_Exception__init_2), "$_init_", $rt_wrapFunction1(jl_Exception__init_), "$_init_4", $rt_wrapFunction1(jl_Exception__init_1)],
jl_RuntimeException, 0, jl_Exception, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_RuntimeException__init_), "$_init_", $rt_wrapFunction1(jl_RuntimeException__init_0), "$_init_4", $rt_wrapFunction1(jl_RuntimeException__init_2)],
jl_IndexOutOfBoundsException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_IndexOutOfBoundsException__init_0), "$_init_", $rt_wrapFunction1(jl_IndexOutOfBoundsException__init_2)],
owts_Puzzle$PuzzleState, 0, jl_Object, [], 1025, 0, 0, ["$_init_5", $rt_wrapFunction1(owts_Puzzle$PuzzleState__init_), "$applyAlgorithm", $rt_wrapFunction1(owts_Puzzle$PuzzleState_applyAlgorithm), "$getCanonicalMovesByState", $rt_wrapFunction0(owts_Puzzle$PuzzleState_getCanonicalMovesByState), "$getNormalized", $rt_wrapFunction0(owts_Puzzle$PuzzleState_getNormalized), "$isNormalized", $rt_wrapFunction0(owts_Puzzle$PuzzleState_isNormalized), "$getMoveCost", $rt_wrapFunction1(owts_Puzzle$PuzzleState_getMoveCost),
"$equalsNormalized", $rt_wrapFunction1(owts_Puzzle$PuzzleState_equalsNormalized), "$getPuzzle", $rt_wrapFunction0(owts_Puzzle$PuzzleState_getPuzzle), "$isSolved", $rt_wrapFunction0(owts_Puzzle$PuzzleState_isSolved), "$apply", $rt_wrapFunction1(owts_Puzzle$PuzzleState_apply), "$solveIn1", $rt_wrapFunction1(owts_Puzzle$PuzzleState_solveIn), "$movesCommute", $rt_wrapFunction2(owts_Puzzle$PuzzleState_movesCommute)],
owtp_PyraminxPuzzle$PyraminxState, 0, owts_Puzzle$PuzzleState, [], 1, 0, () => owtp_PyraminxPuzzle$PyraminxState_$callClinit(), ["$_init_36", $rt_wrapFunction1(owtp_PyraminxPuzzle$PyraminxState__init_), "$_init_6", $rt_wrapFunction2(owtp_PyraminxPuzzle$PyraminxState__init_0), "$toPyraminxSolverState", $rt_wrapFunction0(owtp_PyraminxPuzzle$PyraminxState_toPyraminxSolverState), "$solveIn1", $rt_wrapFunction1(owtp_PyraminxPuzzle$PyraminxState_solveIn), "$getSuccessorsByName", $rt_wrapFunction0(owtp_PyraminxPuzzle$PyraminxState_getSuccessorsByName),
"$equals", $rt_wrapFunction1(owtp_PyraminxPuzzle$PyraminxState_equals), "$hashCode", $rt_wrapFunction0(owtp_PyraminxPuzzle$PyraminxState_hashCode)],
jur_SpecialToken, 0, jl_Object, [], 1024, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_SpecialToken__init_)],
jur_AbstractCharClass, 0, jur_SpecialToken, [], 1024, 0, () => jur_AbstractCharClass_$callClinit(), ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass__init_), "$getBits", $rt_wrapFunction0(jur_AbstractCharClass_getBits), "$getLowHighSurrogates", $rt_wrapFunction0(jur_AbstractCharClass_getLowHighSurrogates), "$hasLowHighSurrogates", $rt_wrapFunction0(jur_AbstractCharClass_hasLowHighSurrogates), "$mayContainSupplCodepoints", $rt_wrapFunction0(jur_AbstractCharClass_mayContainSupplCodepoints), "$getInstance",
$rt_wrapFunction0(jur_AbstractCharClass_getInstance), "$getSurrogates", $rt_wrapFunction0(jur_AbstractCharClass_getSurrogates), "$getWithoutSurrogates", $rt_wrapFunction0(jur_AbstractCharClass_getWithoutSurrogates), "$hasUCI", $rt_wrapFunction0(jur_AbstractCharClass_hasUCI), "$setNegative", $rt_wrapFunction1(jur_AbstractCharClass_setNegative), "$isNegative", $rt_wrapFunction0(jur_AbstractCharClass_isNegative)],
jur_AbstractCharClass$LazyJavaWhitespace$1, "AbstractCharClass$LazyJavaWhitespace$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_67", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaWhitespace$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaWhitespace$1_contains)],
jur_AbstractCharClass$LazyJavaJavaIdentifierStart, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaJavaIdentifierStart__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaJavaIdentifierStart_computeValue)],
ji_Serializable, 0, jl_Object, [], 1537, 0, 0, 0,
jl_Number, 0, jl_Object, [ji_Serializable], 1025, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_Number__init_)],
jl_Comparable, 0, jl_Object, [], 1537, 0, 0, 0,
jl_Integer, 0, jl_Number, [jl_Comparable], 1, 0, () => jl_Integer_$callClinit(), ["$_init_7", $rt_wrapFunction1(jl_Integer__init_), "$intValue", $rt_wrapFunction0(jl_Integer_intValue)],
owtp_CubePuzzle$CubeState, 0, owts_Puzzle$PuzzleState, [], 1, 0, () => owtp_CubePuzzle$CubeState_$callClinit(), ["$_init_44", $rt_wrapFunction1(owtp_CubePuzzle$CubeState__init_1), "$_init_11", $rt_wrapFunction2(owtp_CubePuzzle$CubeState__init_), "$isNormalized", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_isNormalized), "$getNormalized0", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_getNormalized0), "$toTwoByTwoState", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_toTwoByTwoState), "$toFaceCube", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_toFaceCube),
"$getSuccessorsByName", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_getSuccessorsByName), "$getScrambleSuccessors", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_getScrambleSuccessors), "$getCanonicalMovesByState", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_getCanonicalMovesByState), "$equals", $rt_wrapFunction1(owtp_CubePuzzle$CubeState_equals), "$hashCode", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_hashCode), "$getNormalized", $rt_wrapFunction0(owtp_CubePuzzle$CubeState_getNormalized)],
jl_CloneNotSupportedException, 0, jl_Exception, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_CloneNotSupportedException__init_)],
jur_AbstractSet, 0, jl_Object, [], 1024, 0, () => jur_AbstractSet_$callClinit(), ["$_init_0", $rt_wrapFunction0(jur_AbstractSet__init_), "$_init_18", $rt_wrapFunction1(jur_AbstractSet__init_0), "$find", $rt_wrapFunction3(jur_AbstractSet_find), "$findBack", $rt_wrapFunction4(jur_AbstractSet_findBack), "$setType", $rt_wrapFunction1(jur_AbstractSet_setType), "$getType", $rt_wrapFunction0(jur_AbstractSet_getType), "$getNext", $rt_wrapFunction0(jur_AbstractSet_getNext), "$setNext", $rt_wrapFunction1(jur_AbstractSet_setNext),
"$first", $rt_wrapFunction1(jur_AbstractSet_first), "$processBackRefReplacement", $rt_wrapFunction0(jur_AbstractSet_processBackRefReplacement), "$processSecondPass", $rt_wrapFunction0(jur_AbstractSet_processSecondPass)],
jur_JointSet, 0, jur_AbstractSet, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_JointSet__init_), "$_init_40", $rt_wrapFunction2(jur_JointSet__init_0), "$matches", $rt_wrapFunction3(jur_JointSet_matches), "$setNext", $rt_wrapFunction1(jur_JointSet_setNext), "$first", $rt_wrapFunction1(jur_JointSet_first), "$hasConsumed", $rt_wrapFunction1(jur_JointSet_hasConsumed), "$processSecondPass", $rt_wrapFunction0(jur_JointSet_processSecondPass)],
jur_SingleSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_16", $rt_wrapFunction2(jur_SingleSet__init_), "$matches", $rt_wrapFunction3(jur_SingleSet_matches), "$find", $rt_wrapFunction3(jur_SingleSet_find), "$findBack", $rt_wrapFunction4(jur_SingleSet_findBack), "$first", $rt_wrapFunction1(jur_SingleSet_first), "$processBackRefReplacement", $rt_wrapFunction0(jur_SingleSet_processBackRefReplacement), "$processSecondPass", $rt_wrapFunction0(jur_SingleSet_processSecondPass)],
jl_Long, 0, jl_Number, [jl_Comparable], 1, 0, () => jl_Long_$callClinit(), 0,
ju_Map, 0, jl_Object, [], 1537, 0, 0, 0,
jl_Runnable, 0, jl_Object, [], 1537, 0, 0, 0,
jl_Thread, 0, jl_Object, [jl_Runnable], 1, 0, () => jl_Thread_$callClinit(), ["$_init_", $rt_wrapFunction1(jl_Thread__init_0), "$_init_14", $rt_wrapFunction2(jl_Thread__init_), "$getId", $rt_wrapFunction0(jl_Thread_getId)],
owtp_SkewbPuzzle$SkewbState, 0, owts_Puzzle$PuzzleState, [], 1, 0, () => owtp_SkewbPuzzle$SkewbState_$callClinit(), ["$_init_52", $rt_wrapFunction1(owtp_SkewbPuzzle$SkewbState__init_0), "$_init_15", $rt_wrapFunction2(owtp_SkewbPuzzle$SkewbState__init_), "$getSuccessorsByName", $rt_wrapFunction0(owtp_SkewbPuzzle$SkewbState_getSuccessorsByName), "$equals", $rt_wrapFunction1(owtp_SkewbPuzzle$SkewbState_equals), "$hashCode", $rt_wrapFunction0(owtp_SkewbPuzzle$SkewbState_hashCode)],
jur_SequenceSet$IntHash, 0, jl_Object, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_SequenceSet$IntHash__init_0), "$put0", $rt_wrapFunction2(jur_SequenceSet$IntHash_put), "$get2", $rt_wrapFunction1(jur_SequenceSet$IntHash_get)],
jur_AbstractCharClass$LazyAlpha, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyAlpha__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyAlpha_computeValue)],
jur_AbstractCharClass$LazyDigit, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyDigit__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyDigit_computeValue)],
jur_AbstractCharClass$LazyNonDigit, 0, jur_AbstractCharClass$LazyDigit, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyNonDigit__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyNonDigit_computeValue)],
jur_BackReferencedSingleSet, 0, jur_SingleSet, [], 0, 0, 0, ["$_init_13", $rt_wrapFunction1(jur_BackReferencedSingleSet__init_), "$find", $rt_wrapFunction3(jur_BackReferencedSingleSet_find), "$findBack", $rt_wrapFunction4(jur_BackReferencedSingleSet_findBack), "$processBackRefReplacement", $rt_wrapFunction0(jur_BackReferencedSingleSet_processBackRefReplacement)],
owts_Puzzle$Bucket, 0, jl_Object, [jl_Comparable], 1, 0, 0, ["$_init_7", $rt_wrapFunction1(owts_Puzzle$Bucket__init_), "$getValue1", $rt_wrapFunction0(owts_Puzzle$Bucket_getValue), "$pop", $rt_wrapFunction0(owts_Puzzle$Bucket_pop), "$push", $rt_wrapFunction1(owts_Puzzle$Bucket_push), "$isEmpty", $rt_wrapFunction0(owts_Puzzle$Bucket_isEmpty), "$compareTo", $rt_wrapFunction1(owts_Puzzle$Bucket_compareTo0), "$compareTo0", $rt_wrapFunction1(owts_Puzzle$Bucket_compareTo)],
jur_CIBackReferenceSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_23", $rt_wrapFunction2(jur_CIBackReferenceSet__init_), "$matches", $rt_wrapFunction3(jur_CIBackReferenceSet_matches), "$setNext", $rt_wrapFunction1(jur_CIBackReferenceSet_setNext), "$getString", $rt_wrapFunction1(jur_CIBackReferenceSet_getString), "$hasConsumed", $rt_wrapFunction1(jur_CIBackReferenceSet_hasConsumed)],
jur_AbstractCharClass$LazyWord, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyWord__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyWord_computeValue)],
jur_AbstractCharClass$LazyNonWord, 0, jur_AbstractCharClass$LazyWord, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyNonWord__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyNonWord_computeValue)],
jur_AbstractCharClass$1, "AbstractCharClass$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_8", $rt_wrapFunction2(jur_AbstractCharClass$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$1_contains)],
jur_AbstractCharClass$2, "AbstractCharClass$2", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_9", $rt_wrapFunction3(jur_AbstractCharClass$2__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$2_contains)],
jur_AbstractCharClass$LazyJavaLowerCase, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaLowerCase__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaLowerCase_computeValue)],
jur_LeafSet, 0, jur_AbstractSet, [], 1024, 0, 0, ["$_init_18", $rt_wrapFunction1(jur_LeafSet__init_0), "$_init_0", $rt_wrapFunction0(jur_LeafSet__init_), "$matches", $rt_wrapFunction3(jur_LeafSet_matches), "$charCount", $rt_wrapFunction0(jur_LeafSet_charCount), "$hasConsumed", $rt_wrapFunction1(jur_LeafSet_hasConsumed)],
jur_CISequenceSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_78", $rt_wrapFunction1(jur_CISequenceSet__init_), "$accepts", $rt_wrapFunction2(jur_CISequenceSet_accepts)],
jur_QuantifierSet, 0, jur_AbstractSet, [], 1024, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_QuantifierSet__init_), "$getInnerSet", $rt_wrapFunction0(jur_QuantifierSet_getInnerSet), "$first", $rt_wrapFunction1(jur_QuantifierSet_first), "$hasConsumed", $rt_wrapFunction1(jur_QuantifierSet_hasConsumed), "$processSecondPass", $rt_wrapFunction0(jur_QuantifierSet_processSecondPass)],
jur_LeafQuantifierSet, 0, jur_QuantifierSet, [], 0, 0, 0, ["$_init_20", $rt_wrapFunction3(jur_LeafQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_LeafQuantifierSet_matches)],
jur_CompositeQuantifierSet, 0, jur_LeafQuantifierSet, [], 0, 0, 0, ["$_init_21", $rt_wrapFunction4(jur_CompositeQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_CompositeQuantifierSet_matches)],
jur_PossessiveCompositeQuantifierSet, 0, jur_CompositeQuantifierSet, [], 0, 0, 0, ["$_init_21", $rt_wrapFunction4(jur_PossessiveCompositeQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_PossessiveCompositeQuantifierSet_matches)],
jl_CharSequence, 0, jl_Object, [], 1537, 0, 0, 0,
ju_SequencedMap, 0, jl_Object, [ju_Map], 1537, 0, 0, 0,
jl_StringIndexOutOfBoundsException, 0, jl_IndexOutOfBoundsException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_StringIndexOutOfBoundsException__init_0)],
ju_MissingResourceException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_31", $rt_wrapFunction3(ju_MissingResourceException__init_)]]);
$rt_metadata([ju_Comparator, 0, jl_Object, [], 1537, 0, 0, 0,
ju_TreeMap$ensureRevertedComparator$lambda$_5_0, 0, jl_Object, [ju_Comparator], 1, 0, 0, ["$_init_42", $rt_wrapFunction1(ju_TreeMap$ensureRevertedComparator$lambda$_5_0__init_)],
owts_PuzzleStateAndGenerator, 0, jl_Object, [], 1, 0, 0, ["$_init_35", $rt_wrapFunction2(owts_PuzzleStateAndGenerator__init_0)],
jur_AbstractCharClass$LazyJavaLetterOrDigit$1, "AbstractCharClass$LazyJavaLetterOrDigit$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_87", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaLetterOrDigit$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaLetterOrDigit$1_contains)],
jur_CharClass$18, "CharClass$18", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_94", $rt_wrapFunction2(jur_CharClass$18__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$18_contains), "$toString", $rt_wrapFunction0(jur_CharClass$18_toString)],
jur_GroupQuantifierSet, 0, jur_QuantifierSet, [], 0, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_GroupQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_GroupQuantifierSet_matches)],
jur_PossessiveGroupQuantifierSet, 0, jur_GroupQuantifierSet, [], 0, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_PossessiveGroupQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_PossessiveGroupQuantifierSet_matches)],
ju_AbstractMap, 0, jl_Object, [ju_Map], 1025, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_AbstractMap__init_), "$put", $rt_wrapFunction2(ju_AbstractMap_put)],
ju_SortedMap, 0, jl_Object, [ju_SequencedMap], 1537, 0, 0, 0,
ju_NavigableMap, 0, jl_Object, [ju_SortedMap], 1537, 0, 0, 0,
ju_TreeMap$MapView, 0, ju_AbstractMap, [ju_NavigableMap, ji_Serializable], 0, 0, 0, ["$_init_43", function(var_1, var_2, var_3, var_4, var_5, var_6, var_7, var_8) { ju_TreeMap$MapView__init_(this, var_1, var_2, var_3, var_4, var_5, var_6, var_7, var_8); }, "$firstKey", $rt_wrapFunction0(ju_TreeMap$MapView_firstKey), "$navigableKeySet", $rt_wrapFunction0(ju_TreeMap$MapView_navigableKeySet)],
jur_UCIBackReferenceSet, 0, jur_CIBackReferenceSet, [], 0, 0, 0, ["$_init_23", $rt_wrapFunction2(jur_UCIBackReferenceSet__init_), "$matches", $rt_wrapFunction3(jur_UCIBackReferenceSet_matches)],
jur_CharClass$13, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_91", $rt_wrapFunction2(jur_CharClass$13__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$13_contains)],
jur_CharClass$12, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_91", $rt_wrapFunction2(jur_CharClass$12__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$12_contains)],
jur_CharClass$11, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_90", $rt_wrapFunction4(jur_CharClass$11__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$11_contains)],
jur_AbstractCharClass$LazyCategory, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_32", $rt_wrapFunction2(jur_AbstractCharClass$LazyCategory__init_0), "$_init_33", $rt_wrapFunction3(jur_AbstractCharClass$LazyCategory__init_1), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyCategory_computeValue)],
otci_Base46, 0, jl_Object, [], 17, 0, 0, 0,
jur_CharClass$10, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_90", $rt_wrapFunction4(jur_CharClass$10__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$10_contains)],
jur_CharClass$17, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_90", $rt_wrapFunction4(jur_CharClass$17__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$17_contains)],
jur_UCISequenceSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_78", $rt_wrapFunction1(jur_UCISequenceSet__init_), "$accepts", $rt_wrapFunction2(jur_UCISequenceSet_accepts)],
jur_CharClass$16, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_90", $rt_wrapFunction4(jur_CharClass$16__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$16_contains)],
owtp_TwoByTwoSolver, 0, jl_Object, [], 1, 0, () => owtp_TwoByTwoSolver_$callClinit(), ["$_init_0", $rt_wrapFunction0(owtp_TwoByTwoSolver__init_), "$randomState1", $rt_wrapFunction1(owtp_TwoByTwoSolver_randomState), "$solveIn2", $rt_wrapFunction2(owtp_TwoByTwoSolver_solveIn), "$generateExactly1", $rt_wrapFunction2(owtp_TwoByTwoSolver_generateExactly)],
jur_DotAllQuantifierSet, 0, jur_QuantifierSet, [], 0, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_DotAllQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_DotAllQuantifierSet_matches), "$find", $rt_wrapFunction3(jur_DotAllQuantifierSet_find)],
jur_CharClass$15, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_93", $rt_wrapFunction3(jur_CharClass$15__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$15_contains)],
jur_AbstractCharClass$LazyJavaDefined$1, "AbstractCharClass$LazyJavaDefined$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_74", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaDefined$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaDefined$1_contains)],
jur_CharClass$14, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_93", $rt_wrapFunction3(jur_CharClass$14__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$14_contains)],
jl_String$_clinit_$lambda$_118_0, 0, jl_Object, [ju_Comparator], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_String$_clinit_$lambda$_118_0__init_)],
jur_FSet, 0, jur_AbstractSet, [], 0, 0, () => jur_FSet_$callClinit(), ["$_init_7", $rt_wrapFunction1(jur_FSet__init_), "$matches", $rt_wrapFunction3(jur_FSet_matches), "$getGroupIndex", $rt_wrapFunction0(jur_FSet_getGroupIndex), "$hasConsumed", $rt_wrapFunction1(jur_FSet_hasConsumed)],
jur_BehindFSet, 0, jur_FSet, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_BehindFSet__init_), "$matches", $rt_wrapFunction3(jur_BehindFSet_matches)],
jlr_Reference, 0, jl_Object, [], 1025, 0, 0, 0,
jlr_WeakReference, 0, jlr_Reference, [], 1, 0, 0, ["$_init_24", $rt_wrapFunction2(jlr_WeakReference__init_), "$get3", $rt_wrapFunction0(jlr_WeakReference_get)],
ju_Map$Entry, 0, jl_Object, [], 1537, 0, 0, 0,
ju_WeakHashMap$Entry, 0, jlr_WeakReference, [ju_Map$Entry], 16, 0, 0, ["$_init_89", $rt_wrapFunction3(ju_WeakHashMap$Entry__init_)],
jl_AbstractStringBuilder, 0, jl_Object, [ji_Serializable, jl_CharSequence], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_AbstractStringBuilder__init_0), "$_init_7", $rt_wrapFunction1(jl_AbstractStringBuilder__init_), "$append7", $rt_wrapFunction1(jl_AbstractStringBuilder_append5), "$append8", $rt_wrapFunction1(jl_AbstractStringBuilder_append), "$insert0", $rt_wrapFunction2(jl_AbstractStringBuilder_insert0), "$append9", $rt_wrapFunction1(jl_AbstractStringBuilder_append1), "$append2", $rt_wrapFunction2(jl_AbstractStringBuilder_append7),
"$insert1", $rt_wrapFunction3(jl_AbstractStringBuilder_insert4), "$append10", $rt_wrapFunction1(jl_AbstractStringBuilder_append3), "$insert2", $rt_wrapFunction2(jl_AbstractStringBuilder_insert1), "$insert", $rt_wrapFunction2(jl_AbstractStringBuilder_insert3), "$ensureCapacity", $rt_wrapFunction1(jl_AbstractStringBuilder_ensureCapacity), "$toString", $rt_wrapFunction0(jl_AbstractStringBuilder_toString), "$length", $rt_wrapFunction0(jl_AbstractStringBuilder_length), "$charAt", $rt_wrapFunction1(jl_AbstractStringBuilder_charAt),
"$append5", $rt_wrapFunction3(jl_AbstractStringBuilder_append4), "$insert3", $rt_wrapFunction4(jl_AbstractStringBuilder_insert2), "$append12", $rt_wrapFunction1(jl_AbstractStringBuilder_append6), "$append6", $rt_wrapFunction3(jl_AbstractStringBuilder_append2), "$insert4", $rt_wrapFunction4(jl_AbstractStringBuilder_insert), "$append11", $rt_wrapFunction1(jl_AbstractStringBuilder_append0), "$deleteCharAt0", $rt_wrapFunction1(jl_AbstractStringBuilder_deleteCharAt), "$delete", $rt_wrapFunction2(jl_AbstractStringBuilder_delete)],
jl_Appendable, 0, jl_Object, [], 1537, 0, 0, 0,
jl_StringBuilder, 0, jl_AbstractStringBuilder, [jl_Appendable], 1, 0, 0, ["$_init_7", $rt_wrapFunction1(jl_StringBuilder__init_2), "$_init_0", $rt_wrapFunction0(jl_StringBuilder__init_1), "$append", $rt_wrapFunction1(jl_StringBuilder_append), "$append1", $rt_wrapFunction1(jl_StringBuilder_append2), "$append3", $rt_wrapFunction1(jl_StringBuilder_append1), "$append0", $rt_wrapFunction1(jl_StringBuilder_append0), "$append13", $rt_wrapFunction3(jl_StringBuilder_append3), "$append4", $rt_wrapFunction1(jl_StringBuilder_append6),
"$append14", $rt_wrapFunction3(jl_StringBuilder_append8), "$append19", $rt_wrapFunction1(jl_StringBuilder_append7), "$insert6", $rt_wrapFunction4(jl_StringBuilder_insert1), "$insert5", $rt_wrapFunction4(jl_StringBuilder_insert4), "$insert7", $rt_wrapFunction2(jl_StringBuilder_insert5), "$insert8", $rt_wrapFunction2(jl_StringBuilder_insert2), "$delete0", $rt_wrapFunction2(jl_StringBuilder_delete), "$deleteCharAt", $rt_wrapFunction1(jl_StringBuilder_deleteCharAt), "$insert9", $rt_wrapFunction2(jl_StringBuilder_insert7),
"$insert4", $rt_wrapFunction4(jl_StringBuilder_insert6), "$append6", $rt_wrapFunction3(jl_StringBuilder_append5), "$insert3", $rt_wrapFunction4(jl_StringBuilder_insert3), "$append5", $rt_wrapFunction3(jl_StringBuilder_append4), "$length", $rt_wrapFunction0(jl_StringBuilder_length), "$toString", $rt_wrapFunction0(jl_StringBuilder_toString), "$ensureCapacity", $rt_wrapFunction1(jl_StringBuilder_ensureCapacity), "$insert", $rt_wrapFunction2(jl_StringBuilder_insert0), "$insert2", $rt_wrapFunction2(jl_StringBuilder_insert),
"$insert0", $rt_wrapFunction2(jl_StringBuilder_insert8)],
jur_AbstractCharClass$LazyAlnum, 0, jur_AbstractCharClass$LazyAlpha, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyAlnum__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyAlnum_computeValue)],
jur_CompositeRangeSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_85", $rt_wrapFunction2(jur_CompositeRangeSet__init_0), "$matches", $rt_wrapFunction3(jur_CompositeRangeSet_matches), "$setNext", $rt_wrapFunction1(jur_CompositeRangeSet_setNext), "$hasConsumed", $rt_wrapFunction1(jur_CompositeRangeSet_hasConsumed), "$first", $rt_wrapFunction1(jur_CompositeRangeSet_first)],
ju_ConcurrentModificationException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_ConcurrentModificationException__init_0)],
owts_Puzzle$SortedBuckets, 0, jl_Object, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(owts_Puzzle$SortedBuckets__init_0), "$add3", $rt_wrapFunction2(owts_Puzzle$SortedBuckets_add), "$smallestValue", $rt_wrapFunction0(owts_Puzzle$SortedBuckets_smallestValue), "$isEmpty", $rt_wrapFunction0(owts_Puzzle$SortedBuckets_isEmpty), "$pop", $rt_wrapFunction0(owts_Puzzle$SortedBuckets_pop)],
jur_RandomGenerator, 0, jl_Object, [], 1537, 0, 0, ["$nextInt", $rt_wrapFunction1(jur_RandomGenerator_nextInt)],
owtp_CubePuzzle$CubeMove, 0, jl_Object, [], 1, 0, () => owtp_CubePuzzle$CubeMove_$callClinit(), ["$_init_12", function(var_1, var_2, var_3, var_4, var_5) { owtp_CubePuzzle$CubeMove__init_(this, var_1, var_2, var_3, var_4, var_5); }, "$toString", $rt_wrapFunction0(owtp_CubePuzzle$CubeMove_toString)],
jur_LowHighSurrogateRangeSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_63", $rt_wrapFunction1(jur_LowHighSurrogateRangeSet__init_), "$setNext", $rt_wrapFunction1(jur_LowHighSurrogateRangeSet_setNext), "$matches", $rt_wrapFunction3(jur_LowHighSurrogateRangeSet_matches)],
jur_ReluctantGroupQuantifierSet, 0, jur_GroupQuantifierSet, [], 0, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_ReluctantGroupQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_ReluctantGroupQuantifierSet_matches)],
jur_FinalSet, 0, jur_FSet, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_FinalSet__init_), "$matches", $rt_wrapFunction3(jur_FinalSet_matches)],
ju_Random, 0, jl_Object, [jur_RandomGenerator, ji_Serializable], 1, 0, 0, ["$nextInt", $rt_wrapFunction1(jur_RandomGenerator_nextInt), "$_init_0", $rt_wrapFunction0(ju_Random__init_0), "$_init_26", $rt_wrapFunction1(ju_Random__init_), "$setSeed", $rt_wrapFunction1(ju_Random_setSeed), "$nextInt0", $rt_wrapFunction0(ju_Random_nextInt), "$next0", $rt_wrapFunction1(ju_Random_next)],
WatchTNoodle$WatchRandom, 0, ju_Random, [], 16, 0, 0, ["$_init_26", $rt_wrapFunction1(WatchTNoodle$WatchRandom__init_), "$nextInt", $rt_wrapFunction1(WatchTNoodle$WatchRandom_nextInt)],
jl_ClassCastException, 0, jl_RuntimeException, [], 1, 0, 0, 0,
juf_Supplier, 0, jl_Object, [], 1537, 0, 0, 0,
jl_Cloneable, 0, jl_Object, [], 1537, 0, 0, 0]);
$rt_metadata([ju_HashMap, 0, ju_AbstractMap, [jl_Cloneable, ji_Serializable], 1, 0, 0, ["$newElementArray", $rt_wrapFunction1(ju_HashMap_newElementArray), "$_init_0", $rt_wrapFunction0(ju_HashMap__init_1), "$_init_7", $rt_wrapFunction1(ju_HashMap__init_0), "$_init_27", $rt_wrapFunction2(ju_HashMap__init_2), "$containsKey", $rt_wrapFunction1(ju_HashMap_containsKey), "$entrySet", $rt_wrapFunction0(ju_HashMap_entrySet), "$get", $rt_wrapFunction1(ju_HashMap_get), "$entryByKey", $rt_wrapFunction1(ju_HashMap_entryByKey),
"$findNonNullKeyEntry", $rt_wrapFunction3(ju_HashMap_findNonNullKeyEntry), "$findNullKeyEntry", $rt_wrapFunction0(ju_HashMap_findNullKeyEntry), "$keySet", $rt_wrapFunction0(ju_HashMap_keySet), "$put", $rt_wrapFunction2(ju_HashMap_put), "$rehash0", $rt_wrapFunction1(ju_HashMap_rehash0), "$rehash", $rt_wrapFunction0(ju_HashMap_rehash), "$removeEntry", $rt_wrapFunction1(ju_HashMap_removeEntry), "$size", $rt_wrapFunction0(ju_HashMap_size)],
ju_LinkedHashMap, 0, ju_HashMap, [ju_SequencedMap], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_LinkedHashMap__init_0), "$newElementArray", $rt_wrapFunction1(ju_LinkedHashMap_newElementArray), "$getOrDefault", $rt_wrapFunction2(ju_LinkedHashMap_getOrDefault), "$get", $rt_wrapFunction1(ju_LinkedHashMap_get), "$put", $rt_wrapFunction2(ju_LinkedHashMap_put), "$putImpl0", $rt_wrapFunction4(ju_LinkedHashMap_putImpl), "$entrySet", $rt_wrapFunction0(ju_LinkedHashMap_entrySet), "$removeLinkedEntry", $rt_wrapFunction1(ju_LinkedHashMap_removeLinkedEntry),
"$removeEldestEntry", $rt_wrapFunction1(ju_LinkedHashMap_removeEldestEntry)],
jur_PosPlusGroupQuantifierSet, 0, jur_GroupQuantifierSet, [], 0, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_PosPlusGroupQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_PosPlusGroupQuantifierSet_matches)],
jur_EmptySet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_18", $rt_wrapFunction1(jur_EmptySet__init_0), "$accepts", $rt_wrapFunction2(jur_EmptySet_accepts), "$find", $rt_wrapFunction3(jur_EmptySet_find), "$findBack", $rt_wrapFunction4(jur_EmptySet_findBack), "$hasConsumed", $rt_wrapFunction1(jur_EmptySet_hasConsumed)],
jl_StringBuffer, 0, jl_AbstractStringBuilder, [jl_Appendable], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_StringBuffer__init_0), "$append16", $rt_wrapFunction1(jl_StringBuffer_append0), "$append18", $rt_wrapFunction1(jl_StringBuffer_append1), "$append17", $rt_wrapFunction1(jl_StringBuffer_append3), "$append15", $rt_wrapFunction3(jl_StringBuffer_append4), "$append20", $rt_wrapFunction1(jl_StringBuffer_append2), "$insert10", $rt_wrapFunction4(jl_StringBuffer_insert0), "$insert11", $rt_wrapFunction2(jl_StringBuffer_insert4),
"$insert12", $rt_wrapFunction2(jl_StringBuffer_insert1), "$insert4", $rt_wrapFunction4(jl_StringBuffer_insert3), "$append6", $rt_wrapFunction3(jl_StringBuffer_append), "$charAt", $rt_wrapFunction1(jl_StringBuffer_charAt), "$length", $rt_wrapFunction0(jl_StringBuffer_length), "$toString", $rt_wrapFunction0(jl_StringBuffer_toString), "$ensureCapacity", $rt_wrapFunction1(jl_StringBuffer_ensureCapacity), "$insert2", $rt_wrapFunction2(jl_StringBuffer_insert2), "$insert0", $rt_wrapFunction2(jl_StringBuffer_insert)],
owtp_SkewbSolver$SkewbSolverState, 0, jl_Object, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(owtp_SkewbSolver$SkewbSolverState__init_), "$isSolvable", $rt_wrapFunction0(owtp_SkewbSolver$SkewbSolverState_isSolvable)],
jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1, "AbstractCharClass$LazyJavaUnicodeIdentifierPart$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_72", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart$1_contains)],
jur_AbstractCharClass$PredefinedCharacterClasses, 0, jl_Object, [], 16, 0, () => jur_AbstractCharClass$PredefinedCharacterClasses_$callClinit(), ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$PredefinedCharacterClasses__init_), "$getObject", $rt_wrapFunction1(jur_AbstractCharClass$PredefinedCharacterClasses_getObject)],
owts_Puzzle, "Puzzle", 8, jl_Object, [], 1025, 0, () => owts_Puzzle_$callClinit(), ["$_init_0", $rt_wrapFunction0(owts_Puzzle__init_), "$generateWcaScramble", $rt_wrapFunction1(owts_Puzzle_generateWcaScramble), "$solveIn", $rt_wrapFunction2(owts_Puzzle_solveIn)],
owtp_PyraminxPuzzle, "PyraminxPuzzle", 7, owts_Puzzle, [], 1, 0, () => owtp_PyraminxPuzzle_$callClinit(), ["$_init_0", $rt_wrapFunction0(owtp_PyraminxPuzzle__init_), "$generateRandomMoves", $rt_wrapFunction1(owtp_PyraminxPuzzle_generateRandomMoves), "$getSolvedState", $rt_wrapFunction0(owtp_PyraminxPuzzle_getSolvedState)],
jur_AbstractCharClass$LazyJavaLetter, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaLetter__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaLetter_computeValue)],
jur_DecomposedCharSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_38", $rt_wrapFunction2(jur_DecomposedCharSet__init_), "$setNext", $rt_wrapFunction1(jur_DecomposedCharSet_setNext), "$matches", $rt_wrapFunction3(jur_DecomposedCharSet_matches), "$codePointAt", $rt_wrapFunction3(jur_DecomposedCharSet_codePointAt), "$first", $rt_wrapFunction1(jur_DecomposedCharSet_first), "$hasConsumed", $rt_wrapFunction1(jur_DecomposedCharSet_hasConsumed)],
jur_CIDecomposedCharSet, 0, jur_DecomposedCharSet, [], 0, 0, 0, ["$_init_38", $rt_wrapFunction2(jur_CIDecomposedCharSet__init_)],
ju_MapEntry, 0, jl_Object, [ju_Map$Entry, jl_Cloneable], 0, 0, 0, ["$_init_39", $rt_wrapFunction2(ju_MapEntry__init_), "$getKey", $rt_wrapFunction0(ju_MapEntry_getKey), "$getValue", $rt_wrapFunction0(ju_MapEntry_getValue)],
ju_HashMap$HashEntry, 0, ju_MapEntry, [], 0, 0, 0, ["$_init_29", $rt_wrapFunction2(ju_HashMap$HashEntry__init_)],
ju_LinkedHashMap$LinkedHashMapEntry, 0, ju_HashMap$HashEntry, [], 16, 0, 0, ["$_init_29", $rt_wrapFunction2(ju_LinkedHashMap$LinkedHashMapEntry__init_)],
jur_AheadFSet, 0, jur_FSet, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AheadFSet__init_), "$matches", $rt_wrapFunction3(jur_AheadFSet_matches)],
otci_RandomUtils, 0, jl_Object, [], 1, 0, 0, 0,
jur_AbstractCharClass$LazyASCII, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyASCII__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyASCII_computeValue)],
jur_NonCapJointSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_40", $rt_wrapFunction2(jur_NonCapJointSet__init_), "$matches", $rt_wrapFunction3(jur_NonCapJointSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_NonCapJointSet_hasConsumed)],
jur_AtomicJointSet, 0, jur_NonCapJointSet, [], 0, 0, 0, ["$_init_40", $rt_wrapFunction2(jur_AtomicJointSet__init_), "$matches", $rt_wrapFunction3(jur_AtomicJointSet_matches), "$setNext", $rt_wrapFunction1(jur_AtomicJointSet_setNext)],
jur_PositiveLookAhead, 0, jur_AtomicJointSet, [], 0, 0, 0, ["$_init_40", $rt_wrapFunction2(jur_PositiveLookAhead__init_), "$matches", $rt_wrapFunction3(jur_PositiveLookAhead_matches), "$hasConsumed", $rt_wrapFunction1(jur_PositiveLookAhead_hasConsumed)],
jur_NegativeLookAhead, 0, jur_AtomicJointSet, [], 0, 0, 0, ["$_init_40", $rt_wrapFunction2(jur_NegativeLookAhead__init_), "$matches", $rt_wrapFunction3(jur_NegativeLookAhead_matches), "$hasConsumed", $rt_wrapFunction1(jur_NegativeLookAhead_hasConsumed)],
ju_TreeMap, 0, ju_AbstractMap, [jl_Cloneable, ji_Serializable, ju_NavigableMap], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_TreeMap__init_0), "$_init_41", $rt_wrapFunction1(ju_TreeMap__init_), "$put", $rt_wrapFunction2(ju_TreeMap_put), "$remove2", $rt_wrapFunction1(ju_TreeMap_remove), "$containsKey", $rt_wrapFunction1(ju_TreeMap_containsKey), "$findExact", $rt_wrapFunction1(ju_TreeMap_findExact), "$findExactOrNext", $rt_wrapFunction2(ju_TreeMap_findExactOrNext), "$findNext", $rt_wrapFunction2(ju_TreeMap_findNext),
"$firstKey", $rt_wrapFunction0(ju_TreeMap_firstKey), "$tailMap", $rt_wrapFunction2(ju_TreeMap_tailMap), "$size", $rt_wrapFunction0(ju_TreeMap_size)],
ju_Iterator, 0, jl_Object, [], 1537, 0, 0, 0,
ju_AbstractList$1, 0, jl_Object, [ju_Iterator], 0, 0, 0, ["$_init_55", $rt_wrapFunction1(ju_AbstractList$1__init_), "$hasNext", $rt_wrapFunction0(ju_AbstractList$1_hasNext), "$next", $rt_wrapFunction0(ju_AbstractList$1_next)],
ju_AbstractMap$SimpleEntry, 0, jl_Object, [ju_Map$Entry, ji_Serializable], 1, 0, 0, ["$_init_39", $rt_wrapFunction2(ju_AbstractMap$SimpleEntry__init_), "$getValue", $rt_wrapFunction0(ju_AbstractMap$SimpleEntry_getValue), "$setValue", $rt_wrapFunction1(ju_AbstractMap$SimpleEntry_setValue), "$getKey", $rt_wrapFunction0(ju_AbstractMap$SimpleEntry_getKey)],
owtp_CubePuzzle, 0, owts_Puzzle, [], 1, 0, () => owtp_CubePuzzle_$callClinit(), ["$_init_7", $rt_wrapFunction1(owtp_CubePuzzle__init_), "$getSolvedState0", $rt_wrapFunction0(owtp_CubePuzzle_getSolvedState0), "$getSolvedState", $rt_wrapFunction0(owtp_CubePuzzle_getSolvedState)],
ju_TemplateCollections$AbstractImmutableMap, 0, ju_AbstractMap, [], 1024, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_TemplateCollections$AbstractImmutableMap__init_), "$put", $rt_wrapFunction2(ju_TemplateCollections$AbstractImmutableMap_put)],
jur_Quantifier, "Quantifier", 2, jur_SpecialToken, [jl_Cloneable], 0, 0, 0, ["$_init_23", $rt_wrapFunction2(jur_Quantifier__init_), "$min", $rt_wrapFunction0(jur_Quantifier_min), "$max", $rt_wrapFunction0(jur_Quantifier_max), "$toString", $rt_wrapFunction0(jur_Quantifier_toString)],
jur_AbstractCharClass$LazyJavaUpperCase$1, "AbstractCharClass$LazyJavaUpperCase$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_64", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaUpperCase$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaUpperCase$1_contains)],
jlr_Array, 0, jl_Object, [], 17, 0, 0, 0,
jl_Iterable, 0, jl_Object, [], 1537, 0, 0, 0,
ju_Collection, 0, jl_Object, [jl_Iterable], 1537, 0, 0, 0,
ju_Set, 0, jl_Object, [ju_Collection], 1537, 0, 0, 0,
ju_SequencedCollection, 0, jl_Object, [ju_Collection], 1537, 0, 0, 0,
ju_SequencedSet, 0, jl_Object, [ju_SequencedCollection, ju_Set], 1537, 0, 0, 0,
ju_SortedSet, 0, jl_Object, [ju_Set, ju_SequencedSet], 1537, 0, 0, 0,
ju_ListIterator, 0, jl_Object, [ju_Iterator], 1537, 0, 0, 0,
otpp_ResourceAccessor, 0, jl_Object, [], 16, 0, 0, 0,
jur_AbstractCharClass$LazyJavaDigit, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaDigit__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaDigit_computeValue)],
ju_AbstractCollection, 0, jl_Object, [ju_Collection], 1025, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_AbstractCollection__init_), "$isEmpty", $rt_wrapFunction0(ju_AbstractCollection_isEmpty), "$toArray", $rt_wrapFunction1(ju_AbstractCollection_toArray)],
jur_PossessiveQuantifierSet, 0, jur_LeafQuantifierSet, [], 0, 0, 0, ["$_init_20", $rt_wrapFunction3(jur_PossessiveQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_PossessiveQuantifierSet_matches)],
otci_IntegerUtil, 0, jl_Object, [], 17, 0, 0, 0,
jl_Short, 0, jl_Number, [jl_Comparable], 1, 0, () => jl_Short_$callClinit(), 0,
jur_AltQuantifierSet, 0, jur_LeafQuantifierSet, [], 0, 0, 0, ["$_init_20", $rt_wrapFunction3(jur_AltQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_AltQuantifierSet_matches), "$setNext", $rt_wrapFunction1(jur_AltQuantifierSet_setNext)],
jur_PossessiveAltQuantifierSet, 0, jur_AltQuantifierSet, [], 0, 0, 0, ["$_init_20", $rt_wrapFunction3(jur_PossessiveAltQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_PossessiveAltQuantifierSet_matches)],
jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1, "AbstractCharClass$LazyJavaIdentifierIgnorable$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_86", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaIdentifierIgnorable$1_contains)],
jl_Thread$UncaughtExceptionHandler, 0, jl_Object, [], 1537, 0, 0, 0,
jl_DefaultUncaughtExceptionHandler, 0, jl_Object, [jl_Thread$UncaughtExceptionHandler], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_DefaultUncaughtExceptionHandler__init_)]]);
$rt_metadata([cm_Util, 0, jl_Object, [], 0, 0, () => cm_Util_$callClinit(), 0,
jur_AbstractCharClass$LazyJavaLetter$1, "AbstractCharClass$LazyJavaLetter$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_37", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaLetter$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaLetter$1_contains)],
jur_ReluctantQuantifierSet, 0, jur_LeafQuantifierSet, [], 0, 0, 0, ["$_init_20", $rt_wrapFunction3(jur_ReluctantQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_ReluctantQuantifierSet_matches)],
jl_ThreadLocal, 0, jl_Object, [], 1, 0, () => jl_ThreadLocal_$callClinit(), ["$_init_0", $rt_wrapFunction0(jl_ThreadLocal__init_), "$get3", $rt_wrapFunction0(jl_ThreadLocal_get)],
otji_JS, 0, jl_Object, [], 17, 0, 0, 0,
jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1, "AbstractCharClass$LazyJavaUnicodeIdentifierStart$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_88", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart$1_contains)],
otp_PlatformRunnable, 0, jl_Object, [], 1537, 0, 0, 0,
otciu_UnicodeHelper, 0, jl_Object, [], 17, 0, 0, 0,
jl_Object$monitorEnterWait$lambda$_6_0, 0, jl_Object, [otp_PlatformRunnable], 1, 0, 0, ["$_init_1", $rt_wrapFunction4(jl_Object$monitorEnterWait$lambda$_6_0__init_), "$run", $rt_wrapFunction0(jl_Object$monitorEnterWait$lambda$_6_0_run)],
ju_Objects, 0, jl_Object, [], 17, 0, 0, 0,
ju_TreeMap$TreeNode, 0, ju_AbstractMap$SimpleEntry, [], 0, 0, 0, ["$_init_2", $rt_wrapFunction1(ju_TreeMap$TreeNode__init_), "$balance", $rt_wrapFunction0(ju_TreeMap$TreeNode_balance), "$factor", $rt_wrapFunction0(ju_TreeMap$TreeNode_factor), "$rotateRight", $rt_wrapFunction0(ju_TreeMap$TreeNode_rotateRight), "$rotateLeft", $rt_wrapFunction0(ju_TreeMap$TreeNode_rotateLeft), "$fix", $rt_wrapFunction0(ju_TreeMap$TreeNode_fix), "$forward", $rt_wrapFunction1(ju_TreeMap$TreeNode_forward), "$down", $rt_wrapFunction1(ju_TreeMap$TreeNode_down)],
jur_AbstractCharClass$LazyGraph, 0, jur_AbstractCharClass$LazyAlnum, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyGraph__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyGraph_computeValue)],
jur_AbstractCharClass$LazyPrint, 0, jur_AbstractCharClass$LazyGraph, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyPrint__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyPrint_computeValue)],
jur_AbstractCharClass$LazyJavaSpaceChar, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaSpaceChar__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaSpaceChar_computeValue)],
jur_PositiveLookBehind, 0, jur_AtomicJointSet, [], 0, 0, 0, ["$_init_40", $rt_wrapFunction2(jur_PositiveLookBehind__init_), "$matches", $rt_wrapFunction3(jur_PositiveLookBehind_matches), "$hasConsumed", $rt_wrapFunction1(jur_PositiveLookBehind_hasConsumed)],
jur_SequenceSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_78", $rt_wrapFunction1(jur_SequenceSet__init_), "$accepts", $rt_wrapFunction2(jur_SequenceSet_accepts), "$find", $rt_wrapFunction3(jur_SequenceSet_find), "$findBack", $rt_wrapFunction4(jur_SequenceSet_findBack), "$first", $rt_wrapFunction1(jur_SequenceSet_first), "$indexOf", $rt_wrapFunction3(jur_SequenceSet_indexOf), "$lastIndexOf", $rt_wrapFunction3(jur_SequenceSet_lastIndexOf), "$startsWith", $rt_wrapFunction2(jur_SequenceSet_startsWith)],
ju_Comparator$NaturalOrder, 0, jl_Object, [ju_Comparator], 1, 0, () => ju_Comparator$NaturalOrder_$callClinit(), ["$_init_0", $rt_wrapFunction0(ju_Comparator$NaturalOrder__init_), "$compare", $rt_wrapFunction2(ju_Comparator$NaturalOrder_compare)],
owts_InvalidScrambleException, 0, jl_Exception, [], 1, 0, 0, ["$_init_3", $rt_wrapFunction2(owts_InvalidScrambleException__init_0)],
jur_EOISet, 0, jur_AbstractSet, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_EOISet__init_), "$matches", $rt_wrapFunction3(jur_EOISet_matches), "$hasConsumed", $rt_wrapFunction1(jur_EOISet_hasConsumed)],
ju_Queue, 0, jl_Object, [ju_Collection], 1537, 0, 0, 0,
jl_ArrayStoreException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_ArrayStoreException__init_0)],
jur_AltGroupQuantifierSet, 0, jur_GroupQuantifierSet, [], 0, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_AltGroupQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_AltGroupQuantifierSet_matches), "$setNext", $rt_wrapFunction1(jur_AltGroupQuantifierSet_setNext)],
jur_AbstractCharClass$LazyUpper, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyUpper__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyUpper_computeValue)],
jur_MatchResult, 0, jl_Object, [], 1537, 0, 0, 0,
jur_MatchResultImpl, 0, jl_Object, [jur_MatchResult], 0, 0, 0, ["$_init_60", function(var_1, var_2, var_3, var_4, var_5, var_6, var_7) { jur_MatchResultImpl__init_(this, var_1, var_2, var_3, var_4, var_5, var_6, var_7); }, "$setConsumed", $rt_wrapFunction2(jur_MatchResultImpl_setConsumed), "$getConsumed", $rt_wrapFunction1(jur_MatchResultImpl_getConsumed), "$end0", $rt_wrapFunction0(jur_MatchResultImpl_end), "$end", $rt_wrapFunction1(jur_MatchResultImpl_end0), "$setStart", $rt_wrapFunction2(jur_MatchResultImpl_setStart),
"$setEnd", $rt_wrapFunction2(jur_MatchResultImpl_setEnd), "$getStart", $rt_wrapFunction1(jur_MatchResultImpl_getStart), "$getEnd", $rt_wrapFunction1(jur_MatchResultImpl_getEnd), "$getGroupNoCheck", $rt_wrapFunction1(jur_MatchResultImpl_getGroupNoCheck), "$start0", $rt_wrapFunction0(jur_MatchResultImpl_start), "$start", $rt_wrapFunction1(jur_MatchResultImpl_start0), "$finalizeMatch", $rt_wrapFunction0(jur_MatchResultImpl_finalizeMatch), "$getEnterCounter", $rt_wrapFunction1(jur_MatchResultImpl_getEnterCounter),
"$setEnterCounter", $rt_wrapFunction2(jur_MatchResultImpl_setEnterCounter), "$setValid", $rt_wrapFunction0(jur_MatchResultImpl_setValid), "$isValid", $rt_wrapFunction0(jur_MatchResultImpl_isValid), "$reset", $rt_wrapFunction3(jur_MatchResultImpl_reset0), "$reset0", $rt_wrapFunction0(jur_MatchResultImpl_reset), "$setStartIndex", $rt_wrapFunction1(jur_MatchResultImpl_setStartIndex), "$getLeftBound", $rt_wrapFunction0(jur_MatchResultImpl_getLeftBound), "$getRightBound", $rt_wrapFunction0(jur_MatchResultImpl_getRightBound),
"$setMode", $rt_wrapFunction1(jur_MatchResultImpl_setMode), "$mode", $rt_wrapFunction0(jur_MatchResultImpl_mode), "$useAnchoringBounds", $rt_wrapFunction1(jur_MatchResultImpl_useAnchoringBounds), "$hasAnchoringBounds", $rt_wrapFunction0(jur_MatchResultImpl_hasAnchoringBounds), "$hasTransparentBounds", $rt_wrapFunction0(jur_MatchResultImpl_hasTransparentBounds), "$getPreviousMatchEnd", $rt_wrapFunction0(jur_MatchResultImpl_getPreviousMatchEnd)],
ju_HashMap$AbstractMapIterator, 0, jl_Object, [], 0, 0, 0, ["$_init_28", $rt_wrapFunction1(ju_HashMap$AbstractMapIterator__init_), "$hasNext", $rt_wrapFunction0(ju_HashMap$AbstractMapIterator_hasNext), "$checkConcurrentMod", $rt_wrapFunction0(ju_HashMap$AbstractMapIterator_checkConcurrentMod), "$makeNext", $rt_wrapFunction0(ju_HashMap$AbstractMapIterator_makeNext)],
ju_HashMap$KeyIterator, 0, ju_HashMap$AbstractMapIterator, [ju_Iterator], 0, 0, 0, ["$_init_28", $rt_wrapFunction1(ju_HashMap$KeyIterator__init_), "$next", $rt_wrapFunction0(ju_HashMap$KeyIterator_next)],
jur_UCIRangeSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_63", $rt_wrapFunction1(jur_UCIRangeSet__init_), "$accepts", $rt_wrapFunction2(jur_UCIRangeSet_accepts)],
owts_InvalidMoveException, 0, jl_Exception, [], 1, 0, 0, ["$_init_", $rt_wrapFunction1(owts_InvalidMoveException__init_)],
owtp_SkewbPuzzle, "SkewbPuzzle", 7, owts_Puzzle, [], 1, 0, () => owtp_SkewbPuzzle_$callClinit(), ["$_init_0", $rt_wrapFunction0(owtp_SkewbPuzzle__init_), "$generateRandomMoves", $rt_wrapFunction1(owtp_SkewbPuzzle_generateRandomMoves), "$getSolvedState", $rt_wrapFunction0(owtp_SkewbPuzzle_getSolvedState)],
otji_JSWrapper, 0, jl_Object, [], 17, 0, 0, 0,
jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1, "AbstractCharClass$LazyJavaJavaIdentifierPart$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_57", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaJavaIdentifierPart$1_contains)],
cm_Search, 0, jl_Object, [], 1, 0, () => cm_Search_$callClinit(), ["$_init_0", $rt_wrapFunction0(cm_Search__init_), "$solution", function(var_1, var_2, var_3, var_4, var_5) { return cm_Search_solution(this, var_1, var_2, var_3, var_4, var_5); }, "$initSearch", $rt_wrapFunction0(cm_Search_initSearch), "$verify", $rt_wrapFunction1(cm_Search_verify), "$phase1PreMoves", $rt_wrapFunction4(cm_Search_phase1PreMoves), "$search0", $rt_wrapFunction0(cm_Search_search), "$initPhase2Pre", $rt_wrapFunction0(cm_Search_initPhase2Pre),
"$initPhase2", function(var_1, var_2, var_3, var_4, var_5, var_6, var_7) { return cm_Search_initPhase2(this, var_1, var_2, var_3, var_4, var_5, var_6, var_7); }, "$phase1", $rt_wrapFunction4(cm_Search_phase1), "$searchopt", $rt_wrapFunction0(cm_Search_searchopt), "$phase1opt", function(var_1, var_2, var_3, var_4, var_5, var_6) { return cm_Search_phase1opt(this, var_1, var_2, var_3, var_4, var_5, var_6); }, "$appendSolMove", $rt_wrapFunction1(cm_Search_appendSolMove), "$phase2", function(var_1, var_2, var_3,
var_4, var_5, var_6, var_7, var_8) { return cm_Search_phase2(this, var_1, var_2, var_3, var_4, var_5, var_6, var_7, var_8); }, "$solutionToString", $rt_wrapFunction0(cm_Search_solutionToString)],
jul_Level, 0, jl_Object, [ji_Serializable], 1, 0, () => jul_Level_$callClinit(), ["$_init_53", $rt_wrapFunction2(jul_Level__init_0), "$intValue", $rt_wrapFunction0(jul_Level_intValue)],
ju_AbstractSet, 0, ju_AbstractCollection, [ju_Set], 1025, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_AbstractSet__init_)],
ju_HashSet, 0, ju_AbstractSet, [jl_Cloneable, ji_Serializable], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_HashSet__init_0), "$_init_28", $rt_wrapFunction1(ju_HashSet__init_), "$add", $rt_wrapFunction1(ju_HashSet_add), "$contains", $rt_wrapFunction1(ju_HashSet_contains)],
otp_Platform, 0, jl_Object, [], 17, 0, 0, 0,
jl_Boolean, 0, jl_Object, [ji_Serializable, jl_Comparable], 1, 0, () => jl_Boolean_$callClinit(), ["$_init_54", $rt_wrapFunction1(jl_Boolean__init_0)],
jur_MultiLineSOLSet, 0, jur_AbstractSet, [], 0, 0, 0, ["$_init_83", $rt_wrapFunction1(jur_MultiLineSOLSet__init_), "$matches", $rt_wrapFunction3(jur_MultiLineSOLSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_MultiLineSOLSet_hasConsumed)],
ju_NoSuchElementException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_NoSuchElementException__init_0)],
ju_List, 0, jl_Object, [ju_SequencedCollection], 1537, 0, 0, 0,
ju_AbstractList, 0, ju_AbstractCollection, [ju_List], 1025, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_AbstractList__init_), "$iterator", $rt_wrapFunction0(ju_AbstractList_iterator)],
ju_AbstractSequentialList, 0, ju_AbstractList, [], 1025, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_AbstractSequentialList__init_)],
ju_Deque, 0, jl_Object, [ju_Queue, ju_SequencedCollection], 1537, 0, 0, 0,
ju_LinkedList, 0, ju_AbstractSequentialList, [ju_Deque, jl_Cloneable], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_LinkedList__init_), "$size", $rt_wrapFunction0(ju_LinkedList_size), "$addLast", $rt_wrapFunction1(ju_LinkedList_addLast), "$removeLast", $rt_wrapFunction0(ju_LinkedList_removeLast), "$pollLast", $rt_wrapFunction0(ju_LinkedList_pollLast)],
jlr_AnnotatedElement, 0, jl_Object, [], 1537, 0, 0, 0,
jlr_GenericDeclaration, 0, jl_Object, [jlr_AnnotatedElement], 1537, 0, 0, 0,
owts_AlgorithmBuilder, "AlgorithmBuilder", 8, jl_Object, [], 1, 0, () => owts_AlgorithmBuilder_$callClinit(), ["$_init_65", $rt_wrapFunction2(owts_AlgorithmBuilder__init_), "$_init_34", $rt_wrapFunction2(owts_AlgorithmBuilder__init_0), "$findBestIndexForMove", $rt_wrapFunction2(owts_AlgorithmBuilder_findBestIndexForMove), "$appendMove", $rt_wrapFunction1(owts_AlgorithmBuilder_appendMove), "$appendAlgorithm", $rt_wrapFunction1(owts_AlgorithmBuilder_appendAlgorithm), "$getState", $rt_wrapFunction0(owts_AlgorithmBuilder_getState),
"$toString", $rt_wrapFunction0(owts_AlgorithmBuilder_toString), "$getStateAndGenerator", $rt_wrapFunction0(owts_AlgorithmBuilder_getStateAndGenerator)],
jur_NegativeLookBehind, 0, jur_AtomicJointSet, [], 0, 0, 0, ["$_init_40", $rt_wrapFunction2(jur_NegativeLookBehind__init_), "$matches", $rt_wrapFunction3(jur_NegativeLookBehind_matches), "$hasConsumed", $rt_wrapFunction1(jur_NegativeLookBehind_hasConsumed)],
jur_BackReferenceSet, 0, jur_CIBackReferenceSet, [], 0, 0, 0, ["$_init_23", $rt_wrapFunction2(jur_BackReferenceSet__init_), "$matches", $rt_wrapFunction3(jur_BackReferenceSet_matches), "$find", $rt_wrapFunction3(jur_BackReferenceSet_find), "$findBack", $rt_wrapFunction4(jur_BackReferenceSet_findBack), "$first", $rt_wrapFunction1(jur_BackReferenceSet_first)]]);
$rt_metadata([jur_AbstractCharClass$LazyLower, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyLower__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyLower_computeValue)],
oti_AsyncCallback, 0, jl_Object, [], 1537, 0, 0, 0,
jur_DotQuantifierSet, 0, jur_QuantifierSet, [], 0, 0, 0, ["$_init_82", $rt_wrapFunction4(jur_DotQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_DotQuantifierSet_matches), "$find", $rt_wrapFunction3(jur_DotQuantifierSet_find)],
jur_AbstractCharClass$LazyJavaJavaIdentifierPart, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaJavaIdentifierPart__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaJavaIdentifierPart_computeValue)],
jur_AbstractCharClass$LazyJavaTitleCase, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaTitleCase__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaTitleCase_computeValue)],
jur_PreviousMatch, 0, jur_AbstractSet, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_PreviousMatch__init_), "$matches", $rt_wrapFunction3(jur_PreviousMatch_matches), "$hasConsumed", $rt_wrapFunction1(jur_PreviousMatch_hasConsumed)],
jur_UnifiedQuantifierSet, 0, jur_LeafQuantifierSet, [], 0, 0, 0, ["$_init_81", $rt_wrapFunction1(jur_UnifiedQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_UnifiedQuantifierSet_matches), "$find", $rt_wrapFunction3(jur_UnifiedQuantifierSet_find)],
jlr_Type, 0, jl_Object, [], 1537, 0, 0, 0,
jl_Class, 0, jl_Object, [jlr_GenericDeclaration, jlr_Type], 17, 0, 0, ["$toString", $rt_wrapFunction0(jl_Class_toString), "$getClassInfo", $rt_wrapFunction0(jl_Class_getClassInfo), "$isInstance", $rt_wrapFunction1(jl_Class_isInstance), "$isAssignableFrom", $rt_wrapFunction1(jl_Class_isAssignableFrom), "$getName", $rt_wrapFunction0(jl_Class_getName), "$isPrimitive", $rt_wrapFunction0(jl_Class_isPrimitive), "$isEnum", $rt_wrapFunction0(jl_Class_isEnum), "$isInterface", $rt_wrapFunction0(jl_Class_isInterface),
"$getComponentType", $rt_wrapFunction0(jl_Class_getComponentType), "$desiredAssertionStatus", $rt_wrapFunction0(jl_Class_desiredAssertionStatus), "$getEnumConstants", $rt_wrapFunction0(jl_Class_getEnumConstants), "$initialize", $rt_wrapFunction0(jl_Class_initialize)],
owtp_PyraminxSolver$PyraminxSolverState, 0, jl_Object, [], 1, 0, () => owtp_PyraminxSolver$PyraminxSolverState_$callClinit(), ["$_init_0", $rt_wrapFunction0(owtp_PyraminxSolver$PyraminxSolverState__init_0), "$unsolvedTips", $rt_wrapFunction0(owtp_PyraminxSolver$PyraminxSolverState_unsolvedTips)],
ju_BitSet, 0, jl_Object, [jl_Cloneable, ji_Serializable], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_BitSet__init_0), "$_init_7", $rt_wrapFunction1(ju_BitSet__init_), "$set1", $rt_wrapFunction1(ju_BitSet_set), "$set", $rt_wrapFunction2(ju_BitSet_set0), "$clear0", $rt_wrapFunction1(ju_BitSet_clear0), "$clear1", $rt_wrapFunction2(ju_BitSet_clear), "$get1", $rt_wrapFunction1(ju_BitSet_get), "$nextSetBit", $rt_wrapFunction1(ju_BitSet_nextSetBit), "$nextClearBit", $rt_wrapFunction1(ju_BitSet_nextClearBit), "$intersects",
$rt_wrapFunction1(ju_BitSet_intersects), "$and", $rt_wrapFunction1(ju_BitSet_and), "$andNot", $rt_wrapFunction1(ju_BitSet_andNot), "$or", $rt_wrapFunction1(ju_BitSet_or), "$xor", $rt_wrapFunction1(ju_BitSet_xor), "$isEmpty", $rt_wrapFunction0(ju_BitSet_isEmpty)],
jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1, "AbstractCharClass$LazyJavaJavaIdentifierStart$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_10", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaJavaIdentifierStart$1_contains)],
jur_NonCapFSet, 0, jur_FSet, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_NonCapFSet__init_), "$matches", $rt_wrapFunction3(jur_NonCapFSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_NonCapFSet_hasConsumed)],
ju_NavigableSet, 0, jl_Object, [ju_SortedSet], 1537, 0, 0, 0,
ju_TreeMap$NavigableKeySet, 0, ju_AbstractSet, [ju_NavigableSet], 0, 0, 0, ["$_init_22", $rt_wrapFunction1(ju_TreeMap$NavigableKeySet__init_), "$first0", $rt_wrapFunction0(ju_TreeMap$NavigableKeySet_first)],
WatchTNoodle, 0, jl_Object, [], 1, 0, () => WatchTNoodle_$callClinit(), 0,
jl_Float, 0, jl_Number, [jl_Comparable], 1, 0, () => jl_Float_$callClinit(), 0,
ju_Arrays, 0, jl_Object, [], 1, 0, 0, 0,
jur_CharSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_80", $rt_wrapFunction1(jur_CharSet__init_0), "$charCount", $rt_wrapFunction0(jur_CharSet_charCount), "$accepts", $rt_wrapFunction2(jur_CharSet_accepts), "$find", $rt_wrapFunction3(jur_CharSet_find), "$findBack", $rt_wrapFunction4(jur_CharSet_findBack), "$getChar", $rt_wrapFunction0(jur_CharSet_getChar), "$first", $rt_wrapFunction1(jur_CharSet_first)],
jur_UCISupplCharSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_UCISupplCharSet__init_), "$accepts", $rt_wrapFunction2(jur_UCISupplCharSet_accepts)],
jl_System, 0, jl_Object, [], 17, 0, 0, 0,
jur_CharClass$3, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_92", $rt_wrapFunction3(jur_CharClass$3__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$3_contains)],
jur_CharClass$4, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_90", $rt_wrapFunction4(jur_CharClass$4__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$4_contains)],
jur_CharClass$1, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_91", $rt_wrapFunction2(jur_CharClass$1__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$1_contains)],
jur_CharClass$2, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_92", $rt_wrapFunction3(jur_CharClass$2__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$2_contains)],
jur_AbstractCharClass$LazyRange, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_23", $rt_wrapFunction2(jur_AbstractCharClass$LazyRange__init_0), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyRange_computeValue)],
jur_CharClass$7, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_91", $rt_wrapFunction2(jur_CharClass$7__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$7_contains)],
jur_AbstractCharClass$LazyXDigit, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyXDigit__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyXDigit_computeValue)],
jur_CharClass$8, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_93", $rt_wrapFunction3(jur_CharClass$8__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$8_contains)],
jur_CharClass$5, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_90", $rt_wrapFunction4(jur_CharClass$5__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$5_contains)],
jur_CharClass$6, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_91", $rt_wrapFunction2(jur_CharClass$6__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$6_contains)],
ju_Collections$5, 0, jl_Object, [ju_ListIterator], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_Collections$5__init_)],
ju_LinkedList$Entry, 0, jl_Object, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_LinkedList$Entry__init_)],
jl_Enum, 0, jl_Object, [jl_Comparable, ji_Serializable], 1025, 0, 0, ["$_init_53", $rt_wrapFunction2(jl_Enum__init_), "$name", $rt_wrapFunction0(jl_Enum_name), "$ordinal", $rt_wrapFunction0(jl_Enum_ordinal), "$toString", $rt_wrapFunction0(jl_Enum_toString), "$equals", $rt_wrapFunction1(jl_Enum_equals), "$hashCode", $rt_wrapFunction0(jl_Enum_hashCode)],
owts_AlgorithmBuilder$MergingMode, 0, jl_Enum, [], 65553, 0, () => owts_AlgorithmBuilder$MergingMode_$callClinit(), 0,
jur_DotSet, 0, jur_JointSet, [], 16, 0, 0, ["$_init_83", $rt_wrapFunction1(jur_DotSet__init_), "$matches", $rt_wrapFunction3(jur_DotSet_matches), "$setNext", $rt_wrapFunction1(jur_DotSet_setNext), "$getType", $rt_wrapFunction0(jur_DotSet_getType), "$hasConsumed", $rt_wrapFunction1(jur_DotSet_hasConsumed)],
ju_RandomAccess, 0, jl_Object, [], 1537, 0, 0, 0,
ju_TemplateCollections$AbstractImmutableList, 0, ju_AbstractList, [ju_RandomAccess], 1024, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_TemplateCollections$AbstractImmutableList__init_)],
ju_Collections$3, 0, ju_TemplateCollections$AbstractImmutableList, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_Collections$3__init_)],
jur_CharClass$9, 0, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_93", $rt_wrapFunction3(jur_CharClass$9__init_), "$contains0", $rt_wrapFunction1(jur_CharClass$9_contains)],
jur_Matcher, 0, jl_Object, [jur_MatchResult], 17, 0, 0, ["$find0", $rt_wrapFunction1(jur_Matcher_find), "$find1", $rt_wrapFunction0(jur_Matcher_find0), "$start", $rt_wrapFunction1(jur_Matcher_start0), "$end", $rt_wrapFunction1(jur_Matcher_end), "$start0", $rt_wrapFunction0(jur_Matcher_start), "$end0", $rt_wrapFunction0(jur_Matcher_end0), "$hasTransparentBounds", $rt_wrapFunction0(jur_Matcher_hasTransparentBounds), "$_init_75", $rt_wrapFunction2(jur_Matcher__init_)],
ju_Collections$4, 0, jl_Object, [ju_Iterator], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_Collections$4__init_)],
jl_Character, 0, jl_Object, [jl_Comparable], 1, 0, () => jl_Character_$callClinit(), 0,
jur_DotAllSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_DotAllSet__init_), "$matches", $rt_wrapFunction3(jur_DotAllSet_matches), "$setNext", $rt_wrapFunction1(jur_DotAllSet_setNext), "$getType", $rt_wrapFunction0(jur_DotAllSet_getType), "$hasConsumed", $rt_wrapFunction1(jur_DotAllSet_hasConsumed)],
ju_TemplateCollections$AbstractImmutableSet, 0, ju_AbstractSet, [], 1024, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_TemplateCollections$AbstractImmutableSet__init_)],
ju_Collections$1, 0, ju_TemplateCollections$AbstractImmutableSet, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_Collections$1__init_)],
jur_CICharSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_80", $rt_wrapFunction1(jur_CICharSet__init_0), "$accepts", $rt_wrapFunction2(jur_CICharSet_accepts)],
ju_Collections$2, 0, ju_TemplateCollections$AbstractImmutableMap, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_Collections$2__init_)],
jur_SupplCharSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_SupplCharSet__init_), "$accepts", $rt_wrapFunction2(jur_SupplCharSet_accepts), "$find", $rt_wrapFunction3(jur_SupplCharSet_find), "$findBack", $rt_wrapFunction4(jur_SupplCharSet_findBack), "$getCodePoint", $rt_wrapFunction0(jur_SupplCharSet_getCodePoint), "$first", $rt_wrapFunction1(jur_SupplCharSet_first)],
jur_AbstractCharClass$LazyJavaLowerCase$1, "AbstractCharClass$LazyJavaLowerCase$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_17", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaLowerCase$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaLowerCase$1_contains)]]);
$rt_metadata([cm_CubieCube, 0, jl_Object, [], 1, 0, () => cm_CubieCube_$callClinit(), ["$_init_0", $rt_wrapFunction0(cm_CubieCube__init_3), "$_init_62", $rt_wrapFunction4(cm_CubieCube__init_1), "$_init_61", $rt_wrapFunction1(cm_CubieCube__init_4), "$copy", $rt_wrapFunction1(cm_CubieCube_copy), "$invCubieCube", $rt_wrapFunction0(cm_CubieCube_invCubieCube), "$URFConjugate", $rt_wrapFunction0(cm_CubieCube_URFConjugate), "$getFlip", $rt_wrapFunction0(cm_CubieCube_getFlip), "$setFlip", $rt_wrapFunction1(cm_CubieCube_setFlip),
"$getFlipSym", $rt_wrapFunction0(cm_CubieCube_getFlipSym), "$getTwist", $rt_wrapFunction0(cm_CubieCube_getTwist), "$setTwist", $rt_wrapFunction1(cm_CubieCube_setTwist), "$getTwistSym", $rt_wrapFunction0(cm_CubieCube_getTwistSym), "$getUDSlice", $rt_wrapFunction0(cm_CubieCube_getUDSlice), "$setUDSlice", $rt_wrapFunction1(cm_CubieCube_setUDSlice), "$getCPerm", $rt_wrapFunction0(cm_CubieCube_getCPerm), "$setCPerm", $rt_wrapFunction1(cm_CubieCube_setCPerm), "$getCPermSym", $rt_wrapFunction0(cm_CubieCube_getCPermSym),
"$getEPerm", $rt_wrapFunction0(cm_CubieCube_getEPerm), "$setEPerm", $rt_wrapFunction1(cm_CubieCube_setEPerm), "$getEPermSym", $rt_wrapFunction0(cm_CubieCube_getEPermSym), "$getMPerm", $rt_wrapFunction0(cm_CubieCube_getMPerm), "$setMPerm", $rt_wrapFunction1(cm_CubieCube_setMPerm), "$getCComb", $rt_wrapFunction0(cm_CubieCube_getCComb), "$setCComb", $rt_wrapFunction1(cm_CubieCube_setCComb), "$verify0", $rt_wrapFunction0(cm_CubieCube_verify), "$getEdgeParityBit", $rt_wrapFunction0(cm_CubieCube_getEdgeParityBit),
"$getCornerParityBit", $rt_wrapFunction0(cm_CubieCube_getCornerParityBit), "$selfSymmetry", $rt_wrapFunction0(cm_CubieCube_selfSymmetry)],
otrr_ReflectionInfo, 0, jl_Object, [], 1025, 0, 0, 0,
cm_SearchWCA, 0, cm_Search, [], 1, 0, () => cm_SearchWCA_$callClinit(), ["$_init_0", $rt_wrapFunction0(cm_SearchWCA__init_), "$solution0", function(var_1, var_2, var_3, var_4, var_5, var_6, var_7) { return cm_SearchWCA_solution(this, var_1, var_2, var_3, var_4, var_5, var_6, var_7); }, "$initSearch", $rt_wrapFunction0(cm_SearchWCA_initSearch), "$phase1PreMoves", $rt_wrapFunction4(cm_SearchWCA_phase1PreMoves), "$phase1", $rt_wrapFunction4(cm_SearchWCA_phase1), "$initPhase2Pre", $rt_wrapFunction0(cm_SearchWCA_initPhase2Pre),
"$phase2", function(var_1, var_2, var_3, var_4, var_5, var_6, var_7, var_8) { return cm_SearchWCA_phase2(this, var_1, var_2, var_3, var_4, var_5, var_6, var_7, var_8); }, "$solutionToString", $rt_wrapFunction0(cm_SearchWCA_solutionToString)],
jl_Object$monitorExit$lambda$_8_1, 0, jl_Object, [otp_PlatformRunnable], 1, 0, 0, ["$_init_2", $rt_wrapFunction1(jl_Object$monitorExit$lambda$_8_1__init_), "$run", $rt_wrapFunction0(jl_Object$monitorExit$lambda$_8_1_run)],
jur_AbstractCharClass$LazyCategoryScope, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_32", $rt_wrapFunction2(jur_AbstractCharClass$LazyCategoryScope__init_1), "$_init_33", $rt_wrapFunction3(jur_AbstractCharClass$LazyCategoryScope__init_0), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyCategoryScope_computeValue)],
jur_SupplRangeSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_63", $rt_wrapFunction1(jur_SupplRangeSet__init_), "$matches", $rt_wrapFunction3(jur_SupplRangeSet_matches), "$contains0", $rt_wrapFunction1(jur_SupplRangeSet_contains), "$first", $rt_wrapFunction1(jur_SupplRangeSet_first), "$getChars", $rt_wrapFunction0(jur_SupplRangeSet_getChars), "$setNext", $rt_wrapFunction1(jur_SupplRangeSet_setNext), "$hasConsumed", $rt_wrapFunction1(jur_SupplRangeSet_hasConsumed)],
jur_UCISupplRangeSet, 0, jur_SupplRangeSet, [], 0, 0, 0, ["$_init_63", $rt_wrapFunction1(jur_UCISupplRangeSet__init_0), "$contains0", $rt_wrapFunction1(jur_UCISupplRangeSet_contains)],
jur_AbstractCharClass$LazyJavaUpperCase, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaUpperCase__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaUpperCase_computeValue)],
jur_AbstractLineTerminator, 0, jl_Object, [], 1024, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractLineTerminator__init_)],
owtp_TwoByTwoCubePuzzle, 0, owtp_CubePuzzle, [], 1, 0, () => owtp_TwoByTwoCubePuzzle_$callClinit(), ["$_init_0", $rt_wrapFunction0(owtp_TwoByTwoCubePuzzle__init_), "$generateRandomMoves", $rt_wrapFunction1(owtp_TwoByTwoCubePuzzle_generateRandomMoves), "$solveIn", $rt_wrapFunction2(owtp_TwoByTwoCubePuzzle_solveIn)],
jur_HangulDecomposedCharSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_79", $rt_wrapFunction2(jur_HangulDecomposedCharSet__init_), "$setNext", $rt_wrapFunction1(jur_HangulDecomposedCharSet_setNext), "$matches", $rt_wrapFunction3(jur_HangulDecomposedCharSet_matches), "$first", $rt_wrapFunction1(jur_HangulDecomposedCharSet_first), "$hasConsumed", $rt_wrapFunction1(jur_HangulDecomposedCharSet_hasConsumed)],
jur_AbstractCharClass$LazyPunct, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyPunct__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyPunct_computeValue)],
owtp_TwoByTwoSolver$TwoByTwoState, 0, jl_Object, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(owtp_TwoByTwoSolver$TwoByTwoState__init_)],
jur_AbstractCharClass$LazyJavaTitleCase$1, "AbstractCharClass$LazyJavaTitleCase$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_58", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaTitleCase$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaTitleCase$1_contains)],
ju_Collections$_clinit_$lambda$_59_0, 0, jl_Object, [ju_Comparator], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_Collections$_clinit_$lambda$_59_0__init_)],
jur_AbstractCharClass$LazyJavaMirrored$1, "AbstractCharClass$LazyJavaMirrored$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_68", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaMirrored$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaMirrored$1_contains)],
ju_LinkedHashMapIterator, 0, jl_Object, [], 0, 0, 0, ["$_init_30", $rt_wrapFunction2(ju_LinkedHashMapIterator__init_), "$hasNext", $rt_wrapFunction0(ju_LinkedHashMapIterator_hasNext), "$checkConcurrentMod", $rt_wrapFunction0(ju_LinkedHashMapIterator_checkConcurrentMod), "$makeNext", $rt_wrapFunction0(ju_LinkedHashMapIterator_makeNext)],
jur_AbstractCharClass$LazyJavaISOControl$1, "AbstractCharClass$LazyJavaISOControl$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_69", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaISOControl$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaISOControl$1_contains)],
jur_WordBoundary, 0, jur_AbstractSet, [], 0, 0, 0, ["$_init_54", $rt_wrapFunction1(jur_WordBoundary__init_0), "$matches", $rt_wrapFunction3(jur_WordBoundary_matches), "$hasConsumed", $rt_wrapFunction1(jur_WordBoundary_hasConsumed)],
jur_UEOLSet, 0, jur_AbstractSet, [], 16, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_UEOLSet__init_), "$matches", $rt_wrapFunction3(jur_UEOLSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_UEOLSet_hasConsumed)],
jur_AbstractCharClass$LazySpace, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazySpace__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazySpace_computeValue)],
ju_HashMap$1, 0, ju_AbstractSet, [], 0, 0, 0, ["$_init_28", $rt_wrapFunction1(ju_HashMap$1__init_), "$iterator", $rt_wrapFunction0(ju_HashMap$1_iterator)],
jur_UCICharSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_80", $rt_wrapFunction1(jur_UCICharSet__init_), "$accepts", $rt_wrapFunction2(jur_UCICharSet_accepts)],
jl_Double, 0, jl_Number, [jl_Comparable], 1, 0, () => jl_Double_$callClinit(), 0,
jur_AtomicFSet, 0, jur_FSet, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_AtomicFSet__init_), "$matches", $rt_wrapFunction3(jur_AtomicFSet_matches), "$getIndex", $rt_wrapFunction0(jur_AtomicFSet_getIndex), "$hasConsumed", $rt_wrapFunction1(jur_AtomicFSet_hasConsumed)],
jur_LowSurrogateCharSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_80", $rt_wrapFunction1(jur_LowSurrogateCharSet__init_0), "$setNext", $rt_wrapFunction1(jur_LowSurrogateCharSet_setNext), "$matches", $rt_wrapFunction3(jur_LowSurrogateCharSet_matches), "$find", $rt_wrapFunction3(jur_LowSurrogateCharSet_find), "$findBack", $rt_wrapFunction4(jur_LowSurrogateCharSet_findBack), "$first", $rt_wrapFunction1(jur_LowSurrogateCharSet_first), "$hasConsumed", $rt_wrapFunction1(jur_LowSurrogateCharSet_hasConsumed)],
jl_Error, 0, jl_Throwable, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_Error__init_), "$_init_", $rt_wrapFunction1(jl_Error__init_0)],
jl_AssertionError, 0, jl_Error, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_AssertionError__init_1), "$_init_2", $rt_wrapFunction1(jl_AssertionError__init_0)],
jur_CompositeGroupQuantifierSet, 0, jur_GroupQuantifierSet, [], 0, 0, 0, ["$_init_66", function(var_1, var_2, var_3, var_4, var_5) { jur_CompositeGroupQuantifierSet__init_(this, var_1, var_2, var_3, var_4, var_5); }, "$matches", $rt_wrapFunction3(jur_CompositeGroupQuantifierSet_matches)],
jur_RelCompositeGroupQuantifierSet, 0, jur_CompositeGroupQuantifierSet, [], 0, 0, 0, ["$_init_66", function(var_1, var_2, var_3, var_4, var_5) { jur_RelCompositeGroupQuantifierSet__init_(this, var_1, var_2, var_3, var_4, var_5); }, "$matches", $rt_wrapFunction3(jur_RelCompositeGroupQuantifierSet_matches)],
jlr_ReferenceQueue, 0, jl_Object, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jlr_ReferenceQueue__init_), "$poll0", $rt_wrapFunction0(jlr_ReferenceQueue_poll), "$reportNext", $rt_wrapFunction1(jlr_ReferenceQueue_reportNext)],
ju_TreeSet, 0, ju_AbstractSet, [jl_Cloneable, ju_NavigableSet], 1, 0, () => ju_TreeSet_$callClinit(), ["$_init_0", $rt_wrapFunction0(ju_TreeSet__init_), "$contains", $rt_wrapFunction1(ju_TreeSet_contains), "$size", $rt_wrapFunction0(ju_TreeSet_size), "$add", $rt_wrapFunction1(ju_TreeSet_add), "$remove1", $rt_wrapFunction1(ju_TreeSet_remove), "$tailSet", $rt_wrapFunction1(ju_TreeSet_tailSet), "$first0", $rt_wrapFunction0(ju_TreeSet_first)],
ju_ArrayList, 0, ju_AbstractList, [jl_Cloneable, ji_Serializable, ju_RandomAccess], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_ArrayList__init_1), "$_init_7", $rt_wrapFunction1(ju_ArrayList__init_0), "$ensureCapacity", $rt_wrapFunction1(ju_ArrayList_ensureCapacity), "$get0", $rt_wrapFunction1(ju_ArrayList_get), "$size", $rt_wrapFunction0(ju_ArrayList_size), "$set0", $rt_wrapFunction2(ju_ArrayList_set), "$add", $rt_wrapFunction1(ju_ArrayList_add), "$add2", $rt_wrapFunction2(ju_ArrayList_add0), "$remove0", $rt_wrapFunction1(ju_ArrayList_remove),
"$clear", $rt_wrapFunction0(ju_ArrayList_clear)],
jl_IllegalMonitorStateException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_IllegalMonitorStateException__init_)],
ju_LinkedHashMapIterator$EntryIterator, 0, ju_LinkedHashMapIterator, [ju_Iterator], 0, 0, 0, ["$_init_30", $rt_wrapFunction2(ju_LinkedHashMapIterator$EntryIterator__init_), "$next1", $rt_wrapFunction0(ju_LinkedHashMapIterator$EntryIterator_next), "$next", $rt_wrapFunction0(ju_LinkedHashMapIterator$EntryIterator_next0)],
jur_RelAltGroupQuantifierSet, 0, jur_AltGroupQuantifierSet, [], 0, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_RelAltGroupQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_RelAltGroupQuantifierSet_matches)],
jur_IntHash, 0, jl_Object, [], 0, 0, 0, 0,
jl_ThreadLocal$1, 0, jl_ThreadLocal, [], 0, 0, 0, ["$_init_48", $rt_wrapFunction1(jl_ThreadLocal$1__init_), "$initialValue", $rt_wrapFunction0(jl_ThreadLocal$1_initialValue)],
jl_String, 0, jl_Object, [ji_Serializable, jl_Comparable, jl_CharSequence], 1, 0, () => jl_String_$callClinit(), ["$_init_0", $rt_wrapFunction0(jl_String__init_2), "$_init_47", $rt_wrapFunction1(jl_String__init_), "$_init_2", $rt_wrapFunction1(jl_String__init_4), "$_init_25", $rt_wrapFunction3(jl_String__init_5), "$charAt", $rt_wrapFunction1(jl_String_charAt), "$length", $rt_wrapFunction0(jl_String_length), "$isEmpty", $rt_wrapFunction0(jl_String_isEmpty), "$startsWith0", $rt_wrapFunction2(jl_String_startsWith),
"$startsWith1", $rt_wrapFunction1(jl_String_startsWith0), "$indexOf2", $rt_wrapFunction2(jl_String_indexOf), "$indexOf0", $rt_wrapFunction1(jl_String_indexOf1), "$lastIndexOf1", $rt_wrapFunction2(jl_String_lastIndexOf), "$lastIndexOf2", $rt_wrapFunction1(jl_String_lastIndexOf1), "$indexOf1", $rt_wrapFunction2(jl_String_indexOf0), "$lastIndexOf0", $rt_wrapFunction2(jl_String_lastIndexOf0), "$substring", $rt_wrapFunction2(jl_String_substring), "$substring0", $rt_wrapFunction1(jl_String_substring0), "$subSequence",
$rt_wrapFunction2(jl_String_subSequence), "$trim", $rt_wrapFunction0(jl_String_trim), "$toString", $rt_wrapFunction0(jl_String_toString), "$toCharArray", $rt_wrapFunction0(jl_String_toCharArray), "$equals", $rt_wrapFunction1(jl_String_equals), "$hashCode", $rt_wrapFunction0(jl_String_hashCode), "$split", $rt_wrapFunction1(jl_String_split)],
jl_NegativeArraySizeException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_NegativeArraySizeException__init_)],
jur_ReluctantAltQuantifierSet, 0, jur_AltQuantifierSet, [], 0, 0, 0, ["$_init_20", $rt_wrapFunction3(jur_ReluctantAltQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_ReluctantAltQuantifierSet_matches)],
jur_AbstractCharClass$LazyJavaWhitespace, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaWhitespace__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaWhitespace_computeValue)],
jl_UnsupportedOperationException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_UnsupportedOperationException__init_)],
jur_FSet$PossessiveFSet, 0, jur_AbstractSet, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_FSet$PossessiveFSet__init_), "$matches", $rt_wrapFunction3(jur_FSet$PossessiveFSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_FSet$PossessiveFSet_hasConsumed)],
jl_IllegalArgumentException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_IllegalArgumentException__init_1), "$_init_", $rt_wrapFunction1(jl_IllegalArgumentException__init_2)],
jl_NumberFormatException, 0, jl_IllegalArgumentException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_NumberFormatException__init_1), "$_init_", $rt_wrapFunction1(jl_NumberFormatException__init_)],
jur_PosCompositeGroupQuantifierSet, 0, jur_CompositeGroupQuantifierSet, [], 0, 0, 0, ["$_init_66", function(var_1, var_2, var_3, var_4, var_5) { jur_PosCompositeGroupQuantifierSet__init_(this, var_1, var_2, var_3, var_4, var_5); }, "$matches", $rt_wrapFunction3(jur_PosCompositeGroupQuantifierSet_matches)],
owtp_ThreeByThreeCubePuzzle, "ThreeByThreeCubePuzzle", 7, owtp_CubePuzzle, [], 1, 0, () => owtp_ThreeByThreeCubePuzzle_$callClinit(), ["$_init_0", $rt_wrapFunction0(owtp_ThreeByThreeCubePuzzle__init_), "$solveIn", $rt_wrapFunction2(owtp_ThreeByThreeCubePuzzle_solveIn0), "$solveIn3", $rt_wrapFunction4(owtp_ThreeByThreeCubePuzzle_solveIn), "$generateRandomMoves0", $rt_wrapFunction3(owtp_ThreeByThreeCubePuzzle_generateRandomMoves), "$generateRandomMoves", $rt_wrapFunction1(owtp_ThreeByThreeCubePuzzle_generateRandomMoves0)],
jur_MultiLineEOLSet, 0, jur_AbstractSet, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_MultiLineEOLSet__init_), "$matches", $rt_wrapFunction3(jur_MultiLineEOLSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_MultiLineEOLSet_hasConsumed)],
jur_IntArrHash, 0, jl_Object, [], 0, 0, 0, 0]);
$rt_metadata([ju_ArrayDeque, 0, ju_AbstractCollection, [ju_Deque, jl_Cloneable, ji_Serializable], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_ArrayDeque__init_0), "$_init_7", $rt_wrapFunction1(ju_ArrayDeque__init_), "$addLast", $rt_wrapFunction1(ju_ArrayDeque_addLast), "$removeFirst", $rt_wrapFunction0(ju_ArrayDeque_removeFirst), "$pollFirst", $rt_wrapFunction0(ju_ArrayDeque_pollFirst), "$add", $rt_wrapFunction1(ju_ArrayDeque_add), "$remove", $rt_wrapFunction0(ju_ArrayDeque_remove), "$size", $rt_wrapFunction0(ju_ArrayDeque_size),
"$isEmpty", $rt_wrapFunction0(ju_ArrayDeque_isEmpty)],
jur_AbstractCharClass$LazyJavaMirrored, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaMirrored__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaMirrored_computeValue)],
jur_AbstractCharClass$LazyJavaDigit$1, "AbstractCharClass$LazyJavaDigit$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_46", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaDigit$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaDigit$1_contains)],
jur_AbstractCharClass$LazyJavaISOControl, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaISOControl__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaISOControl_computeValue)],
jl_IllegalStateException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_IllegalStateException__init_0), "$_init_", $rt_wrapFunction1(jl_IllegalStateException__init_)],
owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0, 0, jl_Object, [juf_Supplier], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0__init_), "$get3", $rt_wrapFunction0(owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0_get0), "$get4", $rt_wrapFunction0(owtp_ThreeByThreeCubePuzzle$_init_$lambda$_0_0_get)],
cm_CoordCube, 0, jl_Object, [], 0, 0, () => cm_CoordCube_$callClinit(), ["$_init_0", $rt_wrapFunction0(cm_CoordCube__init_0), "$calcPruning", $rt_wrapFunction1(cm_CoordCube_calcPruning), "$setWithPrun", $rt_wrapFunction2(cm_CoordCube_setWithPrun), "$doMovePrun", $rt_wrapFunction3(cm_CoordCube_doMovePrun), "$doMovePrunConj", $rt_wrapFunction2(cm_CoordCube_doMovePrunConj)],
jur_HighSurrogateCharSet, 0, jur_JointSet, [], 0, 0, 0, ["$_init_80", $rt_wrapFunction1(jur_HighSurrogateCharSet__init_), "$setNext", $rt_wrapFunction1(jur_HighSurrogateCharSet_setNext), "$matches", $rt_wrapFunction3(jur_HighSurrogateCharSet_matches), "$find", $rt_wrapFunction3(jur_HighSurrogateCharSet_find), "$findBack", $rt_wrapFunction4(jur_HighSurrogateCharSet_findBack), "$first", $rt_wrapFunction1(jur_HighSurrogateCharSet_first), "$hasConsumed", $rt_wrapFunction1(jur_HighSurrogateCharSet_hasConsumed)],
jur_ReluctantCompositeQuantifierSet, 0, jur_CompositeQuantifierSet, [], 0, 0, 0, ["$_init_21", $rt_wrapFunction4(jur_ReluctantCompositeQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_ReluctantCompositeQuantifierSet_matches)],
jl_NullPointerException, 0, jl_RuntimeException, [], 1, 0, 0, ["$_init_", $rt_wrapFunction1(jl_NullPointerException__init_1), "$_init_0", $rt_wrapFunction0(jl_NullPointerException__init_0)],
jur_SOLSet, 0, jur_AbstractSet, [], 16, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_SOLSet__init_), "$matches", $rt_wrapFunction3(jur_SOLSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_SOLSet_hasConsumed)],
otpp_AsyncCallbackWrapper, 0, jl_Object, [oti_AsyncCallback], 0, 0, 0, ["$_init_70", $rt_wrapFunction1(otpp_AsyncCallbackWrapper__init_), "$complete", $rt_wrapFunction1(otpp_AsyncCallbackWrapper_complete), "$error", $rt_wrapFunction1(otpp_AsyncCallbackWrapper_error)],
jur_AbstractCharClass$LazyJavaSpaceChar$1, "AbstractCharClass$LazyJavaSpaceChar$1", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_51", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaSpaceChar$1__init_), "$contains0", $rt_wrapFunction1(jur_AbstractCharClass$LazyJavaSpaceChar$1_contains)],
otr_EventQueue$Event, 0, jl_Object, [], 1537, 0, 0, 0,
jl_Object$Monitor, 0, jl_Object, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jl_Object$Monitor__init_)],
jl_ThreadInterruptHandler, 0, jl_Object, [], 1537, 0, 0, 0,
jlr_ReferenceQueue$RemoveCallback, 0, jl_Object, [otr_EventQueue$Event, otp_PlatformRunnable, oti_AsyncCallback, jl_ThreadInterruptHandler], 0, 0, 0, 0,
ju_LinkedHashMapEntrySet, 0, ju_AbstractSet, [ju_SequencedSet], 0, 0, 0, ["$_init_30", $rt_wrapFunction2(ju_LinkedHashMapEntrySet__init_), "$iterator", $rt_wrapFunction0(ju_LinkedHashMapEntrySet_iterator)],
jl_Math, 0, jl_Object, [], 17, 0, 0, 0,
cm_Tools, 0, jl_Object, [], 1, 0, () => cm_Tools_$callClinit(), 0,
ju_HashMap$HashMapEntrySet, 0, ju_AbstractSet, [], 0, 0, 0, ["$_init_28", $rt_wrapFunction1(ju_HashMap$HashMapEntrySet__init_), "$iterator", $rt_wrapFunction0(ju_HashMap$HashMapEntrySet_iterator)],
jl_Byte, 0, jl_Number, [jl_Comparable], 1, 0, () => jl_Byte_$callClinit(), ["$_init_71", $rt_wrapFunction1(jl_Byte__init_)],
jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaUnicodeIdentifierPart_computeValue)],
jur_PatternSyntaxException, 0, jl_IllegalArgumentException, [], 1, 0, 0, ["$_init_76", $rt_wrapFunction3(jur_PatternSyntaxException__init_0)],
owtp_SkewbSolver, 0, jl_Object, [], 1, 0, () => owtp_SkewbSolver_$callClinit(), ["$_init_0", $rt_wrapFunction0(owtp_SkewbSolver__init_), "$search1", function(var_1, var_2, var_3, var_4, var_5, var_6, var_7) { return owtp_SkewbSolver_search(this, var_1, var_2, var_3, var_4, var_5, var_6, var_7); }, "$randomState0", $rt_wrapFunction1(owtp_SkewbSolver_randomState), "$generateExactly0", $rt_wrapFunction3(owtp_SkewbSolver_generateExactly)],
jul_Logger, 0, jl_Object, [], 1, 0, () => jul_Logger_$callClinit(), ["$_init_", $rt_wrapFunction1(jul_Logger__init_), "$log", $rt_wrapFunction1(jul_Logger_log), "$log0", $rt_wrapFunction2(jul_Logger_log0), "$severe", $rt_wrapFunction1(jul_Logger_severe), "$fine", $rt_wrapFunction1(jul_Logger_fine)],
jul_LogRecord, 0, jl_Object, [ji_Serializable], 1, 0, 0, ["$_init_73", $rt_wrapFunction2(jul_LogRecord__init_), "$getLevel", $rt_wrapFunction0(jul_LogRecord_getLevel), "$getMessage", $rt_wrapFunction0(jul_LogRecord_getMessage), "$getParameters", $rt_wrapFunction0(jul_LogRecord_getParameters)],
jur_AbstractCharClass$LazyJavaDefined, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaDefined__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaDefined_computeValue)],
jur_Pattern, 0, jl_Object, [ji_Serializable], 17, 0, 0, ["$matcher", $rt_wrapFunction1(jur_Pattern_matcher), "$split1", $rt_wrapFunction2(jur_Pattern_split0), "$split0", $rt_wrapFunction1(jur_Pattern_split), "$pattern", $rt_wrapFunction0(jur_Pattern_pattern), "$namedGroups", $rt_wrapFunction0(jur_Pattern_namedGroups), "$groupCount", $rt_wrapFunction0(jur_Pattern_groupCount), "$compCount", $rt_wrapFunction0(jur_Pattern_compCount), "$consCount", $rt_wrapFunction0(jur_Pattern_consCount)],
jur_PosAltGroupQuantifierSet, 0, jur_AltGroupQuantifierSet, [], 0, 0, 0, ["$_init_19", $rt_wrapFunction3(jur_PosAltGroupQuantifierSet__init_), "$matches", $rt_wrapFunction3(jur_PosAltGroupQuantifierSet_matches), "$setNext", $rt_wrapFunction1(jur_PosAltGroupQuantifierSet_setNext)],
owts_AlgorithmBuilder$IndexAndMove, 0, jl_Object, [], 1, 0, 0, ["$_init_56", $rt_wrapFunction2(owts_AlgorithmBuilder$IndexAndMove__init_0)],
owts_Color, 0, jl_Object, [], 1, 0, () => owts_Color_$callClinit(), ["$_init_62", $rt_wrapFunction4(owts_Color__init_1), "$_init_45", $rt_wrapFunction3(owts_Color__init_2), "$_init_7", $rt_wrapFunction1(owts_Color__init_3)],
ju_Collections$13, 0, ju_AbstractMap, [], 0, 0, 0, ["$_init_95", $rt_wrapFunction1(ju_Collections$13__init_)],
jur_AbstractCharClass$LazyJavaIdentifierIgnorable, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaIdentifierIgnorable__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaIdentifierIgnorable_computeValue)],
jur_UMultiLineEOLSet, 0, jur_AbstractSet, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_UMultiLineEOLSet__init_), "$matches", $rt_wrapFunction3(jur_UMultiLineEOLSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_UMultiLineEOLSet_hasConsumed)],
jur_AbstractCharClass$LazyJavaLetterOrDigit, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaLetterOrDigit__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaLetterOrDigit_computeValue)],
otciu_UnicodeHelper$Range, 0, jl_Object, [], 1, 0, 0, ["$_init_50", $rt_wrapFunction3(otciu_UnicodeHelper$Range__init_)],
jur_EOLSet, 0, jur_AbstractSet, [], 16, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_EOLSet__init_), "$matches", $rt_wrapFunction3(jur_EOLSet_matches), "$hasConsumed", $rt_wrapFunction1(jur_EOLSet_hasConsumed)],
otr_StringInfo, 0, otrr_ReflectionInfo, [], 17, 0, 0, 0,
jur_AbstractLineTerminator$2, 0, jur_AbstractLineTerminator, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractLineTerminator$2__init_), "$isLineTerminator", $rt_wrapFunction1(jur_AbstractLineTerminator$2_isLineTerminator), "$isAfterLineTerminator", $rt_wrapFunction2(jur_AbstractLineTerminator$2_isAfterLineTerminator)],
otciu_CharMapping, 0, jl_Object, [], 1, 0, 0, ["$_init_49", $rt_wrapFunction2(otciu_CharMapping__init_)],
jur_AbstractLineTerminator$1, 0, jur_AbstractLineTerminator, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractLineTerminator$1__init_), "$isLineTerminator", $rt_wrapFunction1(jur_AbstractLineTerminator$1_isLineTerminator), "$isAfterLineTerminator", $rt_wrapFunction2(jur_AbstractLineTerminator$1_isAfterLineTerminator)],
jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyJavaUnicodeIdentifierStart_computeValue)],
jur_Lexer, 0, jl_Object, [], 0, 0, 0, ["$_init_53", $rt_wrapFunction2(jur_Lexer__init_), "$peek", $rt_wrapFunction0(jur_Lexer_peek), "$setMode", $rt_wrapFunction1(jur_Lexer_setMode), "$restoreFlags", $rt_wrapFunction1(jur_Lexer_restoreFlags), "$peekSpecial", $rt_wrapFunction0(jur_Lexer_peekSpecial), "$isSpecial", $rt_wrapFunction0(jur_Lexer_isSpecial), "$isNextSpecial", $rt_wrapFunction0(jur_Lexer_isNextSpecial), "$next2", $rt_wrapFunction0(jur_Lexer_next), "$nextSpecial", $rt_wrapFunction0(jur_Lexer_nextSpecial),
"$lookAhead", $rt_wrapFunction0(jur_Lexer_lookAhead), "$back", $rt_wrapFunction0(jur_Lexer_back), "$toString", $rt_wrapFunction0(jur_Lexer_toString), "$isEmpty", $rt_wrapFunction0(jur_Lexer_isEmpty), "$isLetter0", $rt_wrapFunction0(jur_Lexer_isLetter0), "$isHighSurrogate0", $rt_wrapFunction0(jur_Lexer_isHighSurrogate0), "$isLowSurrogate0", $rt_wrapFunction0(jur_Lexer_isLowSurrogate0), "$getIndex", $rt_wrapFunction0(jur_Lexer_getIndex)],
ju_WeakHashMap, 0, ju_AbstractMap, [ju_Map], 1, 0, 0, ["$_init_0", $rt_wrapFunction0(ju_WeakHashMap__init_0), "$_init_7", $rt_wrapFunction1(ju_WeakHashMap__init_), "$get", $rt_wrapFunction1(ju_WeakHashMap_get), "$isEmpty", $rt_wrapFunction0(ju_WeakHashMap_isEmpty), "$put", $rt_wrapFunction2(ju_WeakHashMap_put), "$size", $rt_wrapFunction0(ju_WeakHashMap_size)],
jur_AbstractCharClass$LazySpecialsBlock, 0, jur_AbstractCharClass$LazyCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazySpecialsBlock__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazySpecialsBlock_computeValue)],
jur_AbstractCharClass$LazyNonSpace, 0, jur_AbstractCharClass$LazySpace, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_AbstractCharClass$LazyNonSpace__init_), "$computeValue", $rt_wrapFunction0(jur_AbstractCharClass$LazyNonSpace_computeValue)],
otci_CharFlow, 0, jl_Object, [], 1, 0, 0, ["$_init_47", $rt_wrapFunction1(otci_CharFlow__init_)],
jur_RangeSet, 0, jur_LeafSet, [], 0, 0, 0, ["$_init_63", $rt_wrapFunction1(jur_RangeSet__init_), "$accepts", $rt_wrapFunction2(jur_RangeSet_accepts), "$first", $rt_wrapFunction1(jur_RangeSet_first), "$getChars", $rt_wrapFunction0(jur_RangeSet_getChars)],
jur_UnicodeCategory, "UnicodeCategory", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_UnicodeCategory__init_), "$contains0", $rt_wrapFunction1(jur_UnicodeCategory_contains)]]);
$rt_metadata([jur_UnicodeCategoryScope, "UnicodeCategoryScope", 2, jur_UnicodeCategory, [], 0, 0, 0, ["$_init_7", $rt_wrapFunction1(jur_UnicodeCategoryScope__init_), "$contains0", $rt_wrapFunction1(jur_UnicodeCategoryScope_contains)],
jur_CharClass, "CharClass", 2, jur_AbstractCharClass, [], 0, 0, 0, ["$_init_0", $rt_wrapFunction0(jur_CharClass__init_2), "$_init_77", $rt_wrapFunction2(jur_CharClass__init_0), "$_init_84", $rt_wrapFunction3(jur_CharClass__init_1), "$add0", $rt_wrapFunction1(jur_CharClass_add), "$add4", $rt_wrapFunction1(jur_CharClass_add1), "$add1", $rt_wrapFunction2(jur_CharClass_add0), "$union", $rt_wrapFunction1(jur_CharClass_union), "$intersection", $rt_wrapFunction1(jur_CharClass_intersection), "$contains0", $rt_wrapFunction1(jur_CharClass_contains),
"$getBits", $rt_wrapFunction0(jur_CharClass_getBits), "$getLowHighSurrogates", $rt_wrapFunction0(jur_CharClass_getLowHighSurrogates), "$getInstance", $rt_wrapFunction0(jur_CharClass_getInstance), "$toString", $rt_wrapFunction0(jur_CharClass_toString), "$hasUCI", $rt_wrapFunction0(jur_CharClass_hasUCI)],
jur_UCIDecomposedCharSet, 0, jur_DecomposedCharSet, [], 0, 0, 0, ["$_init_38", $rt_wrapFunction2(jur_UCIDecomposedCharSet__init_)],
otrr_ClassInfo, 0, otrr_ReflectionInfo, [], 17, 0, 0, ["$newArrayInstance", $rt_wrapFunction1(otrr_ClassInfo_newArrayInstance)],
ju_HashMap$EntryIterator, 0, ju_HashMap$AbstractMapIterator, [ju_Iterator], 0, 0, 0, ["$_init_28", $rt_wrapFunction1(ju_HashMap$EntryIterator__init_), "$next1", $rt_wrapFunction0(ju_HashMap$EntryIterator_next), "$next", $rt_wrapFunction0(ju_HashMap$EntryIterator_next0)],
owtp_PyraminxSolver, 0, jl_Object, [], 1, 0, () => owtp_PyraminxSolver_$callClinit(), ["$_init_0", $rt_wrapFunction0(owtp_PyraminxSolver__init_), "$randomState", $rt_wrapFunction1(owtp_PyraminxSolver_randomState), "$solveIn0", $rt_wrapFunction3(owtp_PyraminxSolver_solveIn), "$generateExactly", $rt_wrapFunction3(owtp_PyraminxSolver_generateExactly)],
owtp_CubePuzzle$Face, "CubePuzzle$Face", 7, jl_Enum, [], 65553, 0, () => owtp_CubePuzzle$Face_$callClinit(), ["$oppositeFace", $rt_wrapFunction0(owtp_CubePuzzle$Face_oppositeFace)],
ju_Collections, 0, jl_Object, [], 17, 0, () => ju_Collections_$callClinit(), 0]);
$rt_enumConstantsMetadata([
    owts_AlgorithmBuilder$MergingMode, () => [owts_AlgorithmBuilder$MergingMode_NO_MERGING, owts_AlgorithmBuilder$MergingMode_CANONICALIZE_MOVES], owtp_CubePuzzle$Face, () => [owtp_CubePuzzle$Face_R, owtp_CubePuzzle$Face_U, owtp_CubePuzzle$Face_F, owtp_CubePuzzle$Face_L, owtp_CubePuzzle$Face_D, owtp_CubePuzzle$Face_B]]);
let $rt_booleanArrayCls = $rt_arraycls($rt_booleancls),
$rt_charArrayCls = $rt_arraycls($rt_charcls),
$rt_byteArrayCls = $rt_arraycls($rt_bytecls),
$rt_intArrayCls = $rt_arraycls($rt_intcls),
$rt_longArrayCls = $rt_arraycls($rt_longcls);
$rt_stringPool(["Can\'t enter monitor from another thread synchronously", "Unrecognized turn ", "ulrb", "", "\'", "String is null", "String is empty", "String contains invalid digits: ", "String contains digits out of radix ", ": ", "The value is too big for int type: ", "The value is too big for integer type", "Illegal radix: ", "URFDLB", "main", "RULB", " ", "U", "U2", "U\'", "R", "R2", "R\'", "F", "F2", "F\'", "null", "w", "bound", "Lower", "Upper", "ASCII", "Alpha", "Digit", "Alnum", "Punct", "Graph", "Print",
"Blank", "Cntrl", "XDigit", "javaLowerCase", "javaUpperCase", "javaWhitespace", "javaMirrored", "javaDefined", "javaDigit", "javaIdentifierIgnorable", "javaISOControl", "javaJavaIdentifierPart", "javaJavaIdentifierStart", "javaLetter", "javaLetterOrDigit", "javaSpaceChar", "javaTitleCase", "javaUnicodeIdentifierPart", "javaUnicodeIdentifierStart", "Space", "W", "s", "S", "d", "D", "BasicLatin", "Latin-1Supplement", "LatinExtended-A", "LatinExtended-B", "IPAExtensions", "SpacingModifierLetters", "CombiningDiacriticalMarks",
"Greek", "Cyrillic", "CyrillicSupplement", "Armenian", "Hebrew", "Arabic", "Syriac", "ArabicSupplement", "Thaana", "Devanagari", "Bengali", "Gurmukhi", "Gujarati", "Oriya", "Tamil", "Telugu", "Kannada", "Malayalam", "Sinhala", "Thai", "Lao", "Tibetan", "Myanmar", "Georgian", "HangulJamo", "Ethiopic", "EthiopicSupplement", "Cherokee", "UnifiedCanadianAboriginalSyllabics", "Ogham", "Runic", "Tagalog", "Hanunoo", "Buhid", "Tagbanwa", "Khmer", "Mongolian", "Limbu", "TaiLe", "NewTaiLue", "KhmerSymbols", "Buginese",
"PhoneticExtensions", "PhoneticExtensionsSupplement", "CombiningDiacriticalMarksSupplement", "LatinExtendedAdditional", "GreekExtended", "GeneralPunctuation", "SuperscriptsandSubscripts", "CurrencySymbols", "CombiningMarksforSymbols", "LetterlikeSymbols", "NumberForms", "Arrows", "MathematicalOperators", "MiscellaneousTechnical", "ControlPictures", "OpticalCharacterRecognition", "EnclosedAlphanumerics", "BoxDrawing", "BlockElements", "GeometricShapes", "MiscellaneousSymbols", "Dingbats", "MiscellaneousMathematicalSymbols-A",
"SupplementalArrows-A", "BraillePatterns", "SupplementalArrows-B", "MiscellaneousMathematicalSymbols-B", "SupplementalMathematicalOperators", "MiscellaneousSymbolsandArrows", "Glagolitic", "Coptic", "GeorgianSupplement", "Tifinagh", "EthiopicExtended", "SupplementalPunctuation", "CJKRadicalsSupplement", "KangxiRadicals", "IdeographicDescriptionCharacters", "CJKSymbolsandPunctuation", "Hiragana", "Katakana", "Bopomofo", "HangulCompatibilityJamo", "Kanbun", "BopomofoExtended", "CJKStrokes", "KatakanaPhoneticExtensions",
"EnclosedCJKLettersandMonths", "CJKCompatibility", "CJKUnifiedIdeographsExtensionA", "YijingHexagramSymbols", "CJKUnifiedIdeographs", "YiSyllables", "YiRadicals", "ModifierToneLetters", "SylotiNagri", "HangulSyllables", "HighSurrogates", "HighPrivateUseSurrogates", "LowSurrogates", "PrivateUseArea", "CJKCompatibilityIdeographs", "AlphabeticPresentationForms", "ArabicPresentationForms-A", "VariationSelectors", "VerticalForms", "CombiningHalfMarks", "CJKCompatibilityForms", "SmallFormVariants", "ArabicPresentationForms-B",
"HalfwidthandFullwidthForms", "all", "Specials", "Cn", "IsL", "Lu", "Ll", "Lt", "Lm", "Lo", "IsM", "Mn", "Me", "Mc", "N", "Nd", "Nl", "No", "IsZ", "Zs", "Zl", "Zp", "IsC", "Cc", "Cf", "Co", "Cs", "IsP", "Pd", "Ps", "Pe", "Pc", "Po", "IsS", "Sm", "Sc", "Sk", "So", "Pi", "Pf", "L", "Invalid cube size", "2", "x", "y", "z", "B", "0", "U ", "R ", "F ", "D ", "D2", "D\'", "L ", "L2", "L\'", "B ", "B2", "B\'", "Invalid scramble: ", "Invalid move: ", "Error ", "Error 8", "Error 7", ".  ", "(", "f)", "OFF", "SEVERE",
"WARNING", "INFO", "CONFIG", "FINE", "FINER", "FINEST", "ALL", "appendMove(", ")", "\\s+", "interface ", "class ", "[L", "222", "333", "pyra", "skewb", "Either src or dest is null", "Class does not represent enum", "Enum ", " does not have the ", " constant", "NO_MERGING", "CANONICALIZE_MOVES", "Error 9", ".", "TNOODLE_333_MIN_DISTANCE", "Error", " while searching for solution to ", "R\' ", "L\' ", "D\' ", "B\' ", "Patter is null", "\\Q", "\\E", "\\\\E\\Q", "Name capturing group should start with letter", "Is",
"In", "u", "u\'", "l", "l\'", "r", "r\'", "b", "b\'"]);
jl_String.prototype.toString = function() {
    return $rt_ustr(this);
};
jl_String.prototype.valueOf = jl_String.prototype.toString;
jl_Object.prototype.toString = function() {
    return $rt_ustr(jl_Object_toString(this));
};
jl_Object.prototype.__teavm_class__ = function() {
    return $dbg_class(this);
};
let $rt_export_main = $rt_mainStarter(WatchTNoodle_main);
$rt_export_main.javaException = $rt_javaException;
let $rt_jso_marker = Symbol('jsoClass');
(() => {
    let c;
})();
$rt_exports.main = $rt_export_main;
$rt_exports.generate = WatchTNoodle_generate$exported$0;
$rt_exports.correction = WatchTNoodle_correction$exported$1;
}));
