var e=Object.create,t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.getPrototypeOf,a=Object.prototype.hasOwnProperty,o=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports),s=(e,n)=>{let r={};for(var i in e)t(r,i,{get:e[i],enumerable:!0});return n||t(r,Symbol.toStringTag,{value:`Module`}),r},c=(e,i,o,s)=>{if(i&&typeof i==`object`||typeof i==`function`)for(var c=r(i),l=0,u=c.length,d;l<u;l++)d=c[l],!a.call(e,d)&&d!==o&&t(e,d,{get:(e=>i[e]).bind(null,d),enumerable:!(s=n(i,d))||s.enumerable});return e},l=(n,r,a)=>(a=n==null?{}:e(i(n)),c(r||!n||!n.__esModule?t(a,`default`,{value:n,enumerable:!0}):a,n));(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var u=o((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.portal`),r=Symbol.for(`react.fragment`),i=Symbol.for(`react.strict_mode`),a=Symbol.for(`react.profiler`),o=Symbol.for(`react.consumer`),s=Symbol.for(`react.context`),c=Symbol.for(`react.forward_ref`),l=Symbol.for(`react.suspense`),u=Symbol.for(`react.memo`),d=Symbol.for(`react.lazy`),f=Symbol.for(`react.activity`),p=Symbol.iterator;function m(e){return typeof e!=`object`||!e?null:(e=p&&e[p]||e[`@@iterator`],typeof e==`function`?e:null)}var h={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},g=Object.assign,_={};function v(e,t,n){this.props=e,this.context=t,this.refs=_,this.updater=n||h}v.prototype.isReactComponent={},v.prototype.setState=function(e,t){if(typeof e!=`object`&&typeof e!=`function`&&e!=null)throw Error(`takes an object of state variables to update or a function which returns an object of state variables.`);this.updater.enqueueSetState(this,e,t,`setState`)},v.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,`forceUpdate`)};function y(){}y.prototype=v.prototype;function b(e,t,n){this.props=e,this.context=t,this.refs=_,this.updater=n||h}var x=b.prototype=new y;x.constructor=b,g(x,v.prototype),x.isPureReactComponent=!0;var S=Array.isArray;function C(){}var w={H:null,A:null,T:null,S:null},T=Object.prototype.hasOwnProperty;function E(e,n,r){var i=r.ref;return{$$typeof:t,type:e,key:n,ref:i===void 0?null:i,props:r}}function D(e,t){return E(e.type,t,e.props)}function O(e){return typeof e==`object`&&!!e&&e.$$typeof===t}function k(e){var t={"=":`=0`,":":`=2`};return`$`+e.replace(/[=:]/g,function(e){return t[e]})}var A=/\/+/g;function ee(e,t){return typeof e==`object`&&e&&e.key!=null?k(``+e.key):t.toString(36)}function j(e){switch(e.status){case`fulfilled`:return e.value;case`rejected`:throw e.reason;default:switch(typeof e.status==`string`?e.then(C,C):(e.status=`pending`,e.then(function(t){e.status===`pending`&&(e.status=`fulfilled`,e.value=t)},function(t){e.status===`pending`&&(e.status=`rejected`,e.reason=t)})),e.status){case`fulfilled`:return e.value;case`rejected`:throw e.reason}}throw e}function M(e,r,i,a,o){var s=typeof e;(s===`undefined`||s===`boolean`)&&(e=null);var c=!1;if(e===null)c=!0;else switch(s){case`bigint`:case`string`:case`number`:c=!0;break;case`object`:switch(e.$$typeof){case t:case n:c=!0;break;case d:return c=e._init,M(c(e._payload),r,i,a,o)}}if(c)return o=o(e),c=a===``?`.`+ee(e,0):a,S(o)?(i=``,c!=null&&(i=c.replace(A,`$&/`)+`/`),M(o,r,i,``,function(e){return e})):o!=null&&(O(o)&&(o=D(o,i+(o.key==null||e&&e.key===o.key?``:(``+o.key).replace(A,`$&/`)+`/`)+c)),r.push(o)),1;c=0;var l=a===``?`.`:a+`:`;if(S(e))for(var u=0;u<e.length;u++)a=e[u],s=l+ee(a,u),c+=M(a,r,i,s,o);else if(u=m(e),typeof u==`function`)for(e=u.call(e),u=0;!(a=e.next()).done;)a=a.value,s=l+ee(a,u++),c+=M(a,r,i,s,o);else if(s===`object`){if(typeof e.then==`function`)return M(j(e),r,i,a,o);throw r=String(e),Error(`Objects are not valid as a React child (found: `+(r===`[object Object]`?`object with keys {`+Object.keys(e).join(`, `)+`}`:r)+`). If you meant to render a collection of children, use an array instead.`)}return c}function te(e,t,n){if(e==null)return e;var r=[],i=0;return M(e,r,``,``,function(e){return t.call(n,e,i++)}),r}function N(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(t){(e._status===0||e._status===-1)&&(e._status=1,e._result=t)},function(t){(e._status===0||e._status===-1)&&(e._status=2,e._result=t)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var P=typeof reportError==`function`?reportError:function(e){if(typeof window==`object`&&typeof window.ErrorEvent==`function`){var t=new window.ErrorEvent(`error`,{bubbles:!0,cancelable:!0,message:typeof e==`object`&&e&&typeof e.message==`string`?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process==`object`&&typeof process.emit==`function`){process.emit(`uncaughtException`,e);return}console.error(e)},F={map:te,forEach:function(e,t,n){te(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return te(e,function(){t++}),t},toArray:function(e){return te(e,function(e){return e})||[]},only:function(e){if(!O(e))throw Error(`React.Children.only expected to receive a single React element child.`);return e}};e.Activity=f,e.Children=F,e.Component=v,e.Fragment=r,e.Profiler=a,e.PureComponent=b,e.StrictMode=i,e.Suspense=l,e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=w,e.__COMPILER_RUNTIME={__proto__:null,c:function(e){return w.H.useMemoCache(e)}},e.cache=function(e){return function(){return e.apply(null,arguments)}},e.cacheSignal=function(){return null},e.cloneElement=function(e,t,n){if(e==null)throw Error(`The argument must be a React element, but you passed `+e+`.`);var r=g({},e.props),i=e.key;if(t!=null)for(a in t.key!==void 0&&(i=``+t.key),t)!T.call(t,a)||a===`key`||a===`__self`||a===`__source`||a===`ref`&&t.ref===void 0||(r[a]=t[a]);var a=arguments.length-2;if(a===1)r.children=n;else if(1<a){for(var o=Array(a),s=0;s<a;s++)o[s]=arguments[s+2];r.children=o}return E(e.type,i,r)},e.createContext=function(e){return e={$$typeof:s,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:o,_context:e},e},e.createElement=function(e,t,n){var r,i={},a=null;if(t!=null)for(r in t.key!==void 0&&(a=``+t.key),t)T.call(t,r)&&r!==`key`&&r!==`__self`&&r!==`__source`&&(i[r]=t[r]);var o=arguments.length-2;if(o===1)i.children=n;else if(1<o){for(var s=Array(o),c=0;c<o;c++)s[c]=arguments[c+2];i.children=s}if(e&&e.defaultProps)for(r in o=e.defaultProps,o)i[r]===void 0&&(i[r]=o[r]);return E(e,a,i)},e.createRef=function(){return{current:null}},e.forwardRef=function(e){return{$$typeof:c,render:e}},e.isValidElement=O,e.lazy=function(e){return{$$typeof:d,_payload:{_status:-1,_result:e},_init:N}},e.memo=function(e,t){return{$$typeof:u,type:e,compare:t===void 0?null:t}},e.startTransition=function(e){var t=w.T,n={};w.T=n;try{var r=e(),i=w.S;i!==null&&i(n,r),typeof r==`object`&&r&&typeof r.then==`function`&&r.then(C,P)}catch(e){P(e)}finally{t!==null&&n.types!==null&&(t.types=n.types),w.T=t}},e.unstable_useCacheRefresh=function(){return w.H.useCacheRefresh()},e.use=function(e){return w.H.use(e)},e.useActionState=function(e,t,n){return w.H.useActionState(e,t,n)},e.useCallback=function(e,t){return w.H.useCallback(e,t)},e.useContext=function(e){return w.H.useContext(e)},e.useDebugValue=function(){},e.useDeferredValue=function(e,t){return w.H.useDeferredValue(e,t)},e.useEffect=function(e,t){return w.H.useEffect(e,t)},e.useEffectEvent=function(e){return w.H.useEffectEvent(e)},e.useId=function(){return w.H.useId()},e.useImperativeHandle=function(e,t,n){return w.H.useImperativeHandle(e,t,n)},e.useInsertionEffect=function(e,t){return w.H.useInsertionEffect(e,t)},e.useLayoutEffect=function(e,t){return w.H.useLayoutEffect(e,t)},e.useMemo=function(e,t){return w.H.useMemo(e,t)},e.useOptimistic=function(e,t){return w.H.useOptimistic(e,t)},e.useReducer=function(e,t,n){return w.H.useReducer(e,t,n)},e.useRef=function(e){return w.H.useRef(e)},e.useState=function(e){return w.H.useState(e)},e.useSyncExternalStore=function(e,t,n){return w.H.useSyncExternalStore(e,t,n)},e.useTransition=function(){return w.H.useTransition()},e.version=`19.2.7`})),d=o(((e,t)=>{t.exports=u()})),f=o((e=>{function t(e,t){var n=e.length;e.push(t);a:for(;0<n;){var r=n-1>>>1,a=e[r];if(0<i(a,t))e[r]=t,e[n]=a,n=r;else break a}}function n(e){return e.length===0?null:e[0]}function r(e){if(e.length===0)return null;var t=e[0],n=e.pop();if(n!==t){e[0]=n;a:for(var r=0,a=e.length,o=a>>>1;r<o;){var s=2*(r+1)-1,c=e[s],l=s+1,u=e[l];if(0>i(c,n))l<a&&0>i(u,c)?(e[r]=u,e[l]=n,r=l):(e[r]=c,e[s]=n,r=s);else if(l<a&&0>i(u,n))e[r]=u,e[l]=n,r=l;else break a}}return t}function i(e,t){var n=e.sortIndex-t.sortIndex;return n===0?e.id-t.id:n}if(e.unstable_now=void 0,typeof performance==`object`&&typeof performance.now==`function`){var a=performance;e.unstable_now=function(){return a.now()}}else{var o=Date,s=o.now();e.unstable_now=function(){return o.now()-s}}var c=[],l=[],u=1,d=null,f=3,p=!1,m=!1,h=!1,g=!1,_=typeof setTimeout==`function`?setTimeout:null,v=typeof clearTimeout==`function`?clearTimeout:null,y=typeof setImmediate<`u`?setImmediate:null;function b(e){for(var i=n(l);i!==null;){if(i.callback===null)r(l);else if(i.startTime<=e)r(l),i.sortIndex=i.expirationTime,t(c,i);else break;i=n(l)}}function x(e){if(h=!1,b(e),!m)if(n(c)!==null)m=!0,S||(S=!0,O());else{var t=n(l);t!==null&&ee(x,t.startTime-e)}}var S=!1,C=-1,w=5,T=-1;function E(){return g?!0:!(e.unstable_now()-T<w)}function D(){if(g=!1,S){var t=e.unstable_now();T=t;var i=!0;try{a:{m=!1,h&&(h=!1,v(C),C=-1),p=!0;var a=f;try{b:{for(b(t),d=n(c);d!==null&&!(d.expirationTime>t&&E());){var o=d.callback;if(typeof o==`function`){d.callback=null,f=d.priorityLevel;var s=o(d.expirationTime<=t);if(t=e.unstable_now(),typeof s==`function`){d.callback=s,b(t),i=!0;break b}d===n(c)&&r(c),b(t)}else r(c);d=n(c)}if(d!==null)i=!0;else{var u=n(l);u!==null&&ee(x,u.startTime-t),i=!1}}break a}finally{d=null,f=a,p=!1}i=void 0}}finally{i?O():S=!1}}}var O;if(typeof y==`function`)O=function(){y(D)};else if(typeof MessageChannel<`u`){var k=new MessageChannel,A=k.port2;k.port1.onmessage=D,O=function(){A.postMessage(null)}}else O=function(){_(D,0)};function ee(t,n){C=_(function(){t(e.unstable_now())},n)}e.unstable_IdlePriority=5,e.unstable_ImmediatePriority=1,e.unstable_LowPriority=4,e.unstable_NormalPriority=3,e.unstable_Profiling=null,e.unstable_UserBlockingPriority=2,e.unstable_cancelCallback=function(e){e.callback=null},e.unstable_forceFrameRate=function(e){0>e||125<e?console.error(`forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported`):w=0<e?Math.floor(1e3/e):5},e.unstable_getCurrentPriorityLevel=function(){return f},e.unstable_next=function(e){switch(f){case 1:case 2:case 3:var t=3;break;default:t=f}var n=f;f=t;try{return e()}finally{f=n}},e.unstable_requestPaint=function(){g=!0},e.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=f;f=e;try{return t()}finally{f=n}},e.unstable_scheduleCallback=function(r,i,a){var o=e.unstable_now();switch(typeof a==`object`&&a?(a=a.delay,a=typeof a==`number`&&0<a?o+a:o):a=o,r){case 1:var s=-1;break;case 2:s=250;break;case 5:s=1073741823;break;case 4:s=1e4;break;default:s=5e3}return s=a+s,r={id:u++,callback:i,priorityLevel:r,startTime:a,expirationTime:s,sortIndex:-1},a>o?(r.sortIndex=a,t(l,r),n(c)===null&&r===n(l)&&(h?(v(C),C=-1):h=!0,ee(x,a-o))):(r.sortIndex=s,t(c,r),m||p||(m=!0,S||(S=!0,O()))),r},e.unstable_shouldYield=E,e.unstable_wrapCallback=function(e){var t=f;return function(){var n=f;f=t;try{return e.apply(this,arguments)}finally{f=n}}}})),p=o(((e,t)=>{t.exports=f()})),m=o((e=>{var t=d();function n(e){var t=`https://react.dev/errors/`+e;if(1<arguments.length){t+=`?args[]=`+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+=`&args[]=`+encodeURIComponent(arguments[n])}return`Minified React error #`+e+`; visit `+t+` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`}function r(){}var i={d:{f:r,r:function(){throw Error(n(522))},D:r,C:r,L:r,m:r,X:r,S:r,M:r},p:0,findDOMNode:null},a=Symbol.for(`react.portal`);function o(e,t,n){var r=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:a,key:r==null?null:``+r,children:e,containerInfo:t,implementation:n}}var s=t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function c(e,t){if(e===`font`)return``;if(typeof t==`string`)return t===`use-credentials`?t:``}e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=i,e.createPortal=function(e,t){var r=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11)throw Error(n(299));return o(e,t,null,r)},e.flushSync=function(e){var t=s.T,n=i.p;try{if(s.T=null,i.p=2,e)return e()}finally{s.T=t,i.p=n,i.d.f()}},e.preconnect=function(e,t){typeof e==`string`&&(t?(t=t.crossOrigin,t=typeof t==`string`?t===`use-credentials`?t:``:void 0):t=null,i.d.C(e,t))},e.prefetchDNS=function(e){typeof e==`string`&&i.d.D(e)},e.preinit=function(e,t){if(typeof e==`string`&&t&&typeof t.as==`string`){var n=t.as,r=c(n,t.crossOrigin),a=typeof t.integrity==`string`?t.integrity:void 0,o=typeof t.fetchPriority==`string`?t.fetchPriority:void 0;n===`style`?i.d.S(e,typeof t.precedence==`string`?t.precedence:void 0,{crossOrigin:r,integrity:a,fetchPriority:o}):n===`script`&&i.d.X(e,{crossOrigin:r,integrity:a,fetchPriority:o,nonce:typeof t.nonce==`string`?t.nonce:void 0})}},e.preinitModule=function(e,t){if(typeof e==`string`)if(typeof t==`object`&&t){if(t.as==null||t.as===`script`){var n=c(t.as,t.crossOrigin);i.d.M(e,{crossOrigin:n,integrity:typeof t.integrity==`string`?t.integrity:void 0,nonce:typeof t.nonce==`string`?t.nonce:void 0})}}else t??i.d.M(e)},e.preload=function(e,t){if(typeof e==`string`&&typeof t==`object`&&t&&typeof t.as==`string`){var n=t.as,r=c(n,t.crossOrigin);i.d.L(e,n,{crossOrigin:r,integrity:typeof t.integrity==`string`?t.integrity:void 0,nonce:typeof t.nonce==`string`?t.nonce:void 0,type:typeof t.type==`string`?t.type:void 0,fetchPriority:typeof t.fetchPriority==`string`?t.fetchPriority:void 0,referrerPolicy:typeof t.referrerPolicy==`string`?t.referrerPolicy:void 0,imageSrcSet:typeof t.imageSrcSet==`string`?t.imageSrcSet:void 0,imageSizes:typeof t.imageSizes==`string`?t.imageSizes:void 0,media:typeof t.media==`string`?t.media:void 0})}},e.preloadModule=function(e,t){if(typeof e==`string`)if(t){var n=c(t.as,t.crossOrigin);i.d.m(e,{as:typeof t.as==`string`&&t.as!==`script`?t.as:void 0,crossOrigin:n,integrity:typeof t.integrity==`string`?t.integrity:void 0})}else i.d.m(e)},e.requestFormReset=function(e){i.d.r(e)},e.unstable_batchedUpdates=function(e,t){return e(t)},e.useFormState=function(e,t,n){return s.H.useFormState(e,t,n)},e.useFormStatus=function(){return s.H.useHostTransitionStatus()},e.version=`19.2.7`})),h=o(((e,t)=>{function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>`u`||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!=`function`))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(e){console.error(e)}}n(),t.exports=m()})),g=o((e=>{var t=p(),n=d(),r=h();function i(e){var t=`https://react.dev/errors/`+e;if(1<arguments.length){t+=`?args[]=`+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+=`&args[]=`+encodeURIComponent(arguments[n])}return`Minified React error #`+e+`; visit `+t+` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`}function a(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function o(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,t.flags&4098&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function s(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function c(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function l(e){if(o(e)!==e)throw Error(i(188))}function u(e){var t=e.alternate;if(!t){if(t=o(e),t===null)throw Error(i(188));return t===e?e:null}for(var n=e,r=t;;){var a=n.return;if(a===null)break;var s=a.alternate;if(s===null){if(r=a.return,r!==null){n=r;continue}break}if(a.child===s.child){for(s=a.child;s;){if(s===n)return l(a),e;if(s===r)return l(a),t;s=s.sibling}throw Error(i(188))}if(n.return!==r.return)n=a,r=s;else{for(var c=!1,u=a.child;u;){if(u===n){c=!0,n=a,r=s;break}if(u===r){c=!0,r=a,n=s;break}u=u.sibling}if(!c){for(u=s.child;u;){if(u===n){c=!0,n=s,r=a;break}if(u===r){c=!0,r=s,n=a;break}u=u.sibling}if(!c)throw Error(i(189))}}if(n.alternate!==r)throw Error(i(190))}if(n.tag!==3)throw Error(i(188));return n.stateNode.current===n?e:t}function f(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=f(e),t!==null)return t;e=e.sibling}return null}var m=Object.assign,g=Symbol.for(`react.element`),_=Symbol.for(`react.transitional.element`),v=Symbol.for(`react.portal`),y=Symbol.for(`react.fragment`),b=Symbol.for(`react.strict_mode`),x=Symbol.for(`react.profiler`),S=Symbol.for(`react.consumer`),C=Symbol.for(`react.context`),w=Symbol.for(`react.forward_ref`),T=Symbol.for(`react.suspense`),E=Symbol.for(`react.suspense_list`),D=Symbol.for(`react.memo`),O=Symbol.for(`react.lazy`),k=Symbol.for(`react.activity`),A=Symbol.for(`react.memo_cache_sentinel`),ee=Symbol.iterator;function j(e){return typeof e!=`object`||!e?null:(e=ee&&e[ee]||e[`@@iterator`],typeof e==`function`?e:null)}var M=Symbol.for(`react.client.reference`);function te(e){if(e==null)return null;if(typeof e==`function`)return e.$$typeof===M?null:e.displayName||e.name||null;if(typeof e==`string`)return e;switch(e){case y:return`Fragment`;case x:return`Profiler`;case b:return`StrictMode`;case T:return`Suspense`;case E:return`SuspenseList`;case k:return`Activity`}if(typeof e==`object`)switch(e.$$typeof){case v:return`Portal`;case C:return e.displayName||`Context`;case S:return(e._context.displayName||`Context`)+`.Consumer`;case w:var t=e.render;return e=e.displayName,e||=(e=t.displayName||t.name||``,e===``?`ForwardRef`:`ForwardRef(`+e+`)`),e;case D:return t=e.displayName||null,t===null?te(e.type)||`Memo`:t;case O:t=e._payload,e=e._init;try{return te(e(t))}catch{}}return null}var N=Array.isArray,P=n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,F=r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,ne={pending:!1,data:null,method:null,action:null},re=[],ie=-1;function I(e){return{current:e}}function ae(e){0>ie||(e.current=re[ie],re[ie]=null,ie--)}function L(e,t){ie++,re[ie]=e.current,e.current=t}var oe=I(null),se=I(null),ce=I(null),le=I(null);function ue(e,t){switch(L(ce,t),L(se,e),L(oe,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?Gd(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=Gd(t),e=Kd(t,e);else switch(e){case`svg`:e=1;break;case`math`:e=2;break;default:e=0}}ae(oe),L(oe,e)}function R(){ae(oe),ae(se),ae(ce)}function z(e){e.memoizedState!==null&&L(le,e);var t=oe.current,n=Kd(t,e.type);t!==n&&(L(se,e),L(oe,n))}function de(e){se.current===e&&(ae(oe),ae(se)),le.current===e&&(ae(le),ep._currentValue=ne)}var fe,pe;function B(e){if(fe===void 0)try{throw Error()}catch(e){var t=e.stack.trim().match(/\n( *(at )?)/);fe=t&&t[1]||``,pe=-1<e.stack.indexOf(`
    at`)?` (<anonymous>)`:-1<e.stack.indexOf(`@`)?`@unknown:0:0`:``}return`
`+fe+e+pe}var me=!1;function V(e,t){if(!e||me)return``;me=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var r={DetermineComponentFrameRoot:function(){try{if(t){var n=function(){throw Error()};if(Object.defineProperty(n.prototype,`props`,{set:function(){throw Error()}}),typeof Reflect==`object`&&Reflect.construct){try{Reflect.construct(n,[])}catch(e){var r=e}Reflect.construct(e,[],n)}else{try{n.call()}catch(e){r=e}e.call(n.prototype)}}else{try{throw Error()}catch(e){r=e}(n=e())&&typeof n.catch==`function`&&n.catch(function(){})}}catch(e){if(e&&r&&typeof e.stack==`string`)return[e.stack,r.stack]}return[null,null]}};r.DetermineComponentFrameRoot.displayName=`DetermineComponentFrameRoot`;var i=Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot,`name`);i&&i.configurable&&Object.defineProperty(r.DetermineComponentFrameRoot,`name`,{value:`DetermineComponentFrameRoot`});var a=r.DetermineComponentFrameRoot(),o=a[0],s=a[1];if(o&&s){var c=o.split(`
`),l=s.split(`
`);for(i=r=0;r<c.length&&!c[r].includes(`DetermineComponentFrameRoot`);)r++;for(;i<l.length&&!l[i].includes(`DetermineComponentFrameRoot`);)i++;if(r===c.length||i===l.length)for(r=c.length-1,i=l.length-1;1<=r&&0<=i&&c[r]!==l[i];)i--;for(;1<=r&&0<=i;r--,i--)if(c[r]!==l[i]){if(r!==1||i!==1)do if(r--,i--,0>i||c[r]!==l[i]){var u=`
`+c[r].replace(` at new `,` at `);return e.displayName&&u.includes(`<anonymous>`)&&(u=u.replace(`<anonymous>`,e.displayName)),u}while(1<=r&&0<=i);break}}}finally{me=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:``)?B(n):``}function H(e,t){switch(e.tag){case 26:case 27:case 5:return B(e.type);case 16:return B(`Lazy`);case 13:return e.child!==t&&t!==null?B(`Suspense Fallback`):B(`Suspense`);case 19:return B(`SuspenseList`);case 0:case 15:return V(e.type,!1);case 11:return V(e.type.render,!1);case 1:return V(e.type,!0);case 31:return B(`Activity`);default:return``}}function he(e){try{var t=``,n=null;do t+=H(e,n),n=e,e=e.return;while(e);return t}catch(e){return`
Error generating stack: `+e.message+`
`+e.stack}}var ge=Object.prototype.hasOwnProperty,_e=t.unstable_scheduleCallback,U=t.unstable_cancelCallback,ve=t.unstable_shouldYield,ye=t.unstable_requestPaint,be=t.unstable_now,xe=t.unstable_getCurrentPriorityLevel,Se=t.unstable_ImmediatePriority,Ce=t.unstable_UserBlockingPriority,we=t.unstable_NormalPriority,Te=t.unstable_LowPriority,Ee=t.unstable_IdlePriority,De=t.log,Oe=t.unstable_setDisableYieldValue,ke=null,Ae=null;function je(e){if(typeof De==`function`&&Oe(e),Ae&&typeof Ae.setStrictMode==`function`)try{Ae.setStrictMode(ke,e)}catch{}}var Me=Math.clz32?Math.clz32:Fe,Ne=Math.log,Pe=Math.LN2;function Fe(e){return e>>>=0,e===0?32:31-(Ne(e)/Pe|0)|0}var Ie=256,Le=262144,Re=4194304;function ze(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function Be(e,t,n){var r=e.pendingLanes;if(r===0)return 0;var i=0,a=e.suspendedLanes,o=e.pingedLanes;e=e.warmLanes;var s=r&134217727;return s===0?(s=r&~a,s===0?o===0?n||(n=r&~e,n!==0&&(i=ze(n))):i=ze(o):i=ze(s)):(r=s&~a,r===0?(o&=s,o===0?n||(n=s&~e,n!==0&&(i=ze(n))):i=ze(o)):i=ze(r)),i===0?0:t!==0&&t!==i&&(t&a)===0&&(a=i&-i,n=t&-t,a>=n||a===32&&n&4194048)?t:i}function Ve(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function He(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Ue(){var e=Re;return Re<<=1,!(Re&62914560)&&(Re=4194304),e}function We(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function Ge(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function Ke(e,t,n,r,i,a){var o=e.pendingLanes;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=n,e.entangledLanes&=n,e.errorRecoveryDisabledLanes&=n,e.shellSuspendCounter=0;var s=e.entanglements,c=e.expirationTimes,l=e.hiddenUpdates;for(n=o&~n;0<n;){var u=31-Me(n),d=1<<u;s[u]=0,c[u]=-1;var f=l[u];if(f!==null)for(l[u]=null,u=0;u<f.length;u++){var p=f[u];p!==null&&(p.lane&=-536870913)}n&=~d}r!==0&&qe(e,r,0),a!==0&&i===0&&e.tag!==0&&(e.suspendedLanes|=a&~(o&~t))}function qe(e,t,n){e.pendingLanes|=t,e.suspendedLanes&=~t;var r=31-Me(t);e.entangledLanes|=t,e.entanglements[r]=e.entanglements[r]|1073741824|n&261930}function Je(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var r=31-Me(n),i=1<<r;i&t|e[r]&t&&(e[r]|=t),n&=~i}}function Ye(e,t){var n=t&-t;return n=n&42?1:Xe(n),(n&(e.suspendedLanes|t))===0?n:0}function Xe(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function Ze(e){return e&=-e,2<e?8<e?e&134217727?32:268435456:8:2}function Qe(){var e=F.p;return e===0?(e=window.event,e===void 0?32:gp(e.type)):e}function $e(e,t){var n=F.p;try{return F.p=e,t()}finally{F.p=n}}var et=Math.random().toString(36).slice(2),tt=`__reactFiber$`+et,nt=`__reactProps$`+et,rt=`__reactContainer$`+et,it=`__reactEvents$`+et,at=`__reactListeners$`+et,ot=`__reactHandles$`+et,st=`__reactResources$`+et,ct=`__reactMarker$`+et;function lt(e){delete e[tt],delete e[nt],delete e[it],delete e[at],delete e[ot]}function ut(e){var t=e[tt];if(t)return t;for(var n=e.parentNode;n;){if(t=n[rt]||n[tt]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=pf(e);e!==null;){if(n=e[tt])return n;e=pf(e)}return t}e=n,n=e.parentNode}return null}function dt(e){if(e=e[tt]||e[rt]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function ft(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(i(33))}function pt(e){var t=e[st];return t||=e[st]={hoistableStyles:new Map,hoistableScripts:new Map},t}function mt(e){e[ct]=!0}var ht=new Set,gt={};function _t(e,t){vt(e,t),vt(e+`Capture`,t)}function vt(e,t){for(gt[e]=t,e=0;e<t.length;e++)ht.add(t[e])}var yt=RegExp(`^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$`),bt={},xt={};function St(e){return ge.call(xt,e)?!0:ge.call(bt,e)?!1:yt.test(e)?xt[e]=!0:(bt[e]=!0,!1)}function Ct(e,t,n){if(St(t))if(n===null)e.removeAttribute(t);else{switch(typeof n){case`undefined`:case`function`:case`symbol`:e.removeAttribute(t);return;case`boolean`:var r=t.toLowerCase().slice(0,5);if(r!==`data-`&&r!==`aria-`){e.removeAttribute(t);return}}e.setAttribute(t,``+n)}}function wt(e,t,n){if(n===null)e.removeAttribute(t);else{switch(typeof n){case`undefined`:case`function`:case`symbol`:case`boolean`:e.removeAttribute(t);return}e.setAttribute(t,``+n)}}function Tt(e,t,n,r){if(r===null)e.removeAttribute(n);else{switch(typeof r){case`undefined`:case`function`:case`symbol`:case`boolean`:e.removeAttribute(n);return}e.setAttributeNS(t,n,``+r)}}function Et(e){switch(typeof e){case`bigint`:case`boolean`:case`number`:case`string`:case`undefined`:return e;case`object`:return e;default:return``}}function Dt(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()===`input`&&(t===`checkbox`||t===`radio`)}function Ot(e,t,n){var r=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&r!==void 0&&typeof r.get==`function`&&typeof r.set==`function`){var i=r.get,a=r.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return i.call(this)},set:function(e){n=``+e,a.call(this,e)}}),Object.defineProperty(e,t,{enumerable:r.enumerable}),{getValue:function(){return n},setValue:function(e){n=``+e},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function kt(e){if(!e._valueTracker){var t=Dt(e)?`checked`:`value`;e._valueTracker=Ot(e,t,``+e[t])}}function At(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),r=``;return e&&(r=Dt(e)?e.checked?`true`:`false`:e.value),e=r,e===n?!1:(t.setValue(e),!0)}function jt(e){if(e||=typeof document<`u`?document:void 0,e===void 0)return null;try{return e.activeElement||e.body}catch{return e.body}}var Mt=/[\n"\\]/g;function Nt(e){return e.replace(Mt,function(e){return`\\`+e.charCodeAt(0).toString(16)+` `})}function Pt(e,t,n,r,i,a,o,s){e.name=``,o!=null&&typeof o!=`function`&&typeof o!=`symbol`&&typeof o!=`boolean`?e.type=o:e.removeAttribute(`type`),t==null?o!==`submit`&&o!==`reset`||e.removeAttribute(`value`):o===`number`?(t===0&&e.value===``||e.value!=t)&&(e.value=``+Et(t)):e.value!==``+Et(t)&&(e.value=``+Et(t)),t==null?n==null?r!=null&&e.removeAttribute(`value`):It(e,o,Et(n)):It(e,o,Et(t)),i==null&&a!=null&&(e.defaultChecked=!!a),i!=null&&(e.checked=i&&typeof i!=`function`&&typeof i!=`symbol`),s!=null&&typeof s!=`function`&&typeof s!=`symbol`&&typeof s!=`boolean`?e.name=``+Et(s):e.removeAttribute(`name`)}function Ft(e,t,n,r,i,a,o,s){if(a!=null&&typeof a!=`function`&&typeof a!=`symbol`&&typeof a!=`boolean`&&(e.type=a),t!=null||n!=null){if(!(a!==`submit`&&a!==`reset`||t!=null)){kt(e);return}n=n==null?``:``+Et(n),t=t==null?n:``+Et(t),s||t===e.value||(e.value=t),e.defaultValue=t}r??=i,r=typeof r!=`function`&&typeof r!=`symbol`&&!!r,e.checked=s?e.checked:!!r,e.defaultChecked=!!r,o!=null&&typeof o!=`function`&&typeof o!=`symbol`&&typeof o!=`boolean`&&(e.name=o),kt(e)}function It(e,t,n){t===`number`&&jt(e.ownerDocument)===e||e.defaultValue===``+n||(e.defaultValue=``+n)}function Lt(e,t,n,r){if(e=e.options,t){t={};for(var i=0;i<n.length;i++)t[`$`+n[i]]=!0;for(n=0;n<e.length;n++)i=t.hasOwnProperty(`$`+e[n].value),e[n].selected!==i&&(e[n].selected=i),i&&r&&(e[n].defaultSelected=!0)}else{for(n=``+Et(n),t=null,i=0;i<e.length;i++){if(e[i].value===n){e[i].selected=!0,r&&(e[i].defaultSelected=!0);return}t!==null||e[i].disabled||(t=e[i])}t!==null&&(t.selected=!0)}}function Rt(e,t,n){if(t!=null&&(t=``+Et(t),t!==e.value&&(e.value=t),n==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=n==null?``:``+Et(n)}function zt(e,t,n,r){if(t==null){if(r!=null){if(n!=null)throw Error(i(92));if(N(r)){if(1<r.length)throw Error(i(93));r=r[0]}n=r}n??=``,t=n}n=Et(t),e.defaultValue=n,r=e.textContent,r===n&&r!==``&&r!==null&&(e.value=r),kt(e)}function Bt(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var Vt=new Set(`animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp`.split(` `));function Ht(e,t,n){var r=t.indexOf(`--`)===0;n==null||typeof n==`boolean`||n===``?r?e.setProperty(t,``):t===`float`?e.cssFloat=``:e[t]=``:r?e.setProperty(t,n):typeof n!=`number`||n===0||Vt.has(t)?t===`float`?e.cssFloat=n:e[t]=(``+n).trim():e[t]=n+`px`}function Ut(e,t,n){if(t!=null&&typeof t!=`object`)throw Error(i(62));if(e=e.style,n!=null){for(var r in n)!n.hasOwnProperty(r)||t!=null&&t.hasOwnProperty(r)||(r.indexOf(`--`)===0?e.setProperty(r,``):r===`float`?e.cssFloat=``:e[r]=``);for(var a in t)r=t[a],t.hasOwnProperty(a)&&n[a]!==r&&Ht(e,a,r)}else for(var o in t)t.hasOwnProperty(o)&&Ht(e,o,t[o])}function Wt(e){if(e.indexOf(`-`)===-1)return!1;switch(e){case`annotation-xml`:case`color-profile`:case`font-face`:case`font-face-src`:case`font-face-uri`:case`font-face-format`:case`font-face-name`:case`missing-glyph`:return!1;default:return!0}}var Gt=new Map([[`acceptCharset`,`accept-charset`],[`htmlFor`,`for`],[`httpEquiv`,`http-equiv`],[`crossOrigin`,`crossorigin`],[`accentHeight`,`accent-height`],[`alignmentBaseline`,`alignment-baseline`],[`arabicForm`,`arabic-form`],[`baselineShift`,`baseline-shift`],[`capHeight`,`cap-height`],[`clipPath`,`clip-path`],[`clipRule`,`clip-rule`],[`colorInterpolation`,`color-interpolation`],[`colorInterpolationFilters`,`color-interpolation-filters`],[`colorProfile`,`color-profile`],[`colorRendering`,`color-rendering`],[`dominantBaseline`,`dominant-baseline`],[`enableBackground`,`enable-background`],[`fillOpacity`,`fill-opacity`],[`fillRule`,`fill-rule`],[`floodColor`,`flood-color`],[`floodOpacity`,`flood-opacity`],[`fontFamily`,`font-family`],[`fontSize`,`font-size`],[`fontSizeAdjust`,`font-size-adjust`],[`fontStretch`,`font-stretch`],[`fontStyle`,`font-style`],[`fontVariant`,`font-variant`],[`fontWeight`,`font-weight`],[`glyphName`,`glyph-name`],[`glyphOrientationHorizontal`,`glyph-orientation-horizontal`],[`glyphOrientationVertical`,`glyph-orientation-vertical`],[`horizAdvX`,`horiz-adv-x`],[`horizOriginX`,`horiz-origin-x`],[`imageRendering`,`image-rendering`],[`letterSpacing`,`letter-spacing`],[`lightingColor`,`lighting-color`],[`markerEnd`,`marker-end`],[`markerMid`,`marker-mid`],[`markerStart`,`marker-start`],[`overlinePosition`,`overline-position`],[`overlineThickness`,`overline-thickness`],[`paintOrder`,`paint-order`],[`panose-1`,`panose-1`],[`pointerEvents`,`pointer-events`],[`renderingIntent`,`rendering-intent`],[`shapeRendering`,`shape-rendering`],[`stopColor`,`stop-color`],[`stopOpacity`,`stop-opacity`],[`strikethroughPosition`,`strikethrough-position`],[`strikethroughThickness`,`strikethrough-thickness`],[`strokeDasharray`,`stroke-dasharray`],[`strokeDashoffset`,`stroke-dashoffset`],[`strokeLinecap`,`stroke-linecap`],[`strokeLinejoin`,`stroke-linejoin`],[`strokeMiterlimit`,`stroke-miterlimit`],[`strokeOpacity`,`stroke-opacity`],[`strokeWidth`,`stroke-width`],[`textAnchor`,`text-anchor`],[`textDecoration`,`text-decoration`],[`textRendering`,`text-rendering`],[`transformOrigin`,`transform-origin`],[`underlinePosition`,`underline-position`],[`underlineThickness`,`underline-thickness`],[`unicodeBidi`,`unicode-bidi`],[`unicodeRange`,`unicode-range`],[`unitsPerEm`,`units-per-em`],[`vAlphabetic`,`v-alphabetic`],[`vHanging`,`v-hanging`],[`vIdeographic`,`v-ideographic`],[`vMathematical`,`v-mathematical`],[`vectorEffect`,`vector-effect`],[`vertAdvY`,`vert-adv-y`],[`vertOriginX`,`vert-origin-x`],[`vertOriginY`,`vert-origin-y`],[`wordSpacing`,`word-spacing`],[`writingMode`,`writing-mode`],[`xmlnsXlink`,`xmlns:xlink`],[`xHeight`,`x-height`]]),Kt=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function qt(e){return Kt.test(``+e)?`javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`:e}function Jt(){}var Yt=null;function Xt(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var Zt=null,Qt=null;function $t(e){var t=dt(e);if(t&&(e=t.stateNode)){var n=e[nt]||null;a:switch(e=t.stateNode,t.type){case`input`:if(Pt(e,n.value,n.defaultValue,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name),t=n.name,n.type===`radio`&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll(`input[name="`+Nt(``+t)+`"][type="radio"]`),t=0;t<n.length;t++){var r=n[t];if(r!==e&&r.form===e.form){var a=r[nt]||null;if(!a)throw Error(i(90));Pt(r,a.value,a.defaultValue,a.defaultValue,a.checked,a.defaultChecked,a.type,a.name)}}for(t=0;t<n.length;t++)r=n[t],r.form===e.form&&At(r)}break a;case`textarea`:Rt(e,n.value,n.defaultValue);break a;case`select`:t=n.value,t!=null&&Lt(e,!!n.multiple,t,!1)}}}var en=!1;function tn(e,t,n){if(en)return e(t,n);en=!0;try{return e(t)}finally{if(en=!1,(Zt!==null||Qt!==null)&&(Su(),Zt&&(t=Zt,e=Qt,Qt=Zt=null,$t(t),e)))for(t=0;t<e.length;t++)$t(e[t])}}function nn(e,t){var n=e.stateNode;if(n===null)return null;var r=n[nt]||null;if(r===null)return null;n=r[t];a:switch(t){case`onClick`:case`onClickCapture`:case`onDoubleClick`:case`onDoubleClickCapture`:case`onMouseDown`:case`onMouseDownCapture`:case`onMouseMove`:case`onMouseMoveCapture`:case`onMouseUp`:case`onMouseUpCapture`:case`onMouseEnter`:(r=!r.disabled)||(e=e.type,r=!(e===`button`||e===`input`||e===`select`||e===`textarea`)),e=!r;break a;default:e=!1}if(e)return null;if(n&&typeof n!=`function`)throw Error(i(231,t,typeof n));return n}var rn=!(typeof window>`u`||window.document===void 0||window.document.createElement===void 0),an=!1;if(rn)try{var on={};Object.defineProperty(on,`passive`,{get:function(){an=!0}}),window.addEventListener(`test`,on,on),window.removeEventListener(`test`,on,on)}catch{an=!1}var sn=null,cn=null,ln=null;function un(){if(ln)return ln;var e,t=cn,n=t.length,r,i=`value`in sn?sn.value:sn.textContent,a=i.length;for(e=0;e<n&&t[e]===i[e];e++);var o=n-e;for(r=1;r<=o&&t[n-r]===i[a-r];r++);return ln=i.slice(e,1<r?1-r:void 0)}function dn(e){var t=e.keyCode;return`charCode`in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function fn(){return!0}function pn(){return!1}function mn(e){function t(t,n,r,i,a){for(var o in this._reactName=t,this._targetInst=r,this.type=n,this.nativeEvent=i,this.target=a,this.currentTarget=null,e)e.hasOwnProperty(o)&&(t=e[o],this[o]=t?t(i):i[o]);return this.isDefaultPrevented=(i.defaultPrevented==null?!1===i.returnValue:i.defaultPrevented)?fn:pn,this.isPropagationStopped=pn,this}return m(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var e=this.nativeEvent;e&&(e.preventDefault?e.preventDefault():typeof e.returnValue!=`unknown`&&(e.returnValue=!1),this.isDefaultPrevented=fn)},stopPropagation:function(){var e=this.nativeEvent;e&&(e.stopPropagation?e.stopPropagation():typeof e.cancelBubble!=`unknown`&&(e.cancelBubble=!0),this.isPropagationStopped=fn)},persist:function(){},isPersistent:fn}),t}var hn={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},gn=mn(hn),_n=m({},hn,{view:0,detail:0}),vn=mn(_n),yn,bn,xn,Sn=m({},_n,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Nn,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return`movementX`in e?e.movementX:(e!==xn&&(xn&&e.type===`mousemove`?(yn=e.screenX-xn.screenX,bn=e.screenY-xn.screenY):bn=yn=0,xn=e),yn)},movementY:function(e){return`movementY`in e?e.movementY:bn}}),Cn=mn(Sn),wn=mn(m({},Sn,{dataTransfer:0})),Tn=mn(m({},_n,{relatedTarget:0})),En=mn(m({},hn,{animationName:0,elapsedTime:0,pseudoElement:0})),Dn=mn(m({},hn,{clipboardData:function(e){return`clipboardData`in e?e.clipboardData:window.clipboardData}})),On=mn(m({},hn,{data:0})),kn={Esc:`Escape`,Spacebar:` `,Left:`ArrowLeft`,Up:`ArrowUp`,Right:`ArrowRight`,Down:`ArrowDown`,Del:`Delete`,Win:`OS`,Menu:`ContextMenu`,Apps:`ContextMenu`,Scroll:`ScrollLock`,MozPrintableKey:`Unidentified`},An={8:`Backspace`,9:`Tab`,12:`Clear`,13:`Enter`,16:`Shift`,17:`Control`,18:`Alt`,19:`Pause`,20:`CapsLock`,27:`Escape`,32:` `,33:`PageUp`,34:`PageDown`,35:`End`,36:`Home`,37:`ArrowLeft`,38:`ArrowUp`,39:`ArrowRight`,40:`ArrowDown`,45:`Insert`,46:`Delete`,112:`F1`,113:`F2`,114:`F3`,115:`F4`,116:`F5`,117:`F6`,118:`F7`,119:`F8`,120:`F9`,121:`F10`,122:`F11`,123:`F12`,144:`NumLock`,145:`ScrollLock`,224:`Meta`},jn={Alt:`altKey`,Control:`ctrlKey`,Meta:`metaKey`,Shift:`shiftKey`};function Mn(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=jn[e])?!!t[e]:!1}function Nn(){return Mn}var Pn=mn(m({},_n,{key:function(e){if(e.key){var t=kn[e.key]||e.key;if(t!==`Unidentified`)return t}return e.type===`keypress`?(e=dn(e),e===13?`Enter`:String.fromCharCode(e)):e.type===`keydown`||e.type===`keyup`?An[e.keyCode]||`Unidentified`:``},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Nn,charCode:function(e){return e.type===`keypress`?dn(e):0},keyCode:function(e){return e.type===`keydown`||e.type===`keyup`?e.keyCode:0},which:function(e){return e.type===`keypress`?dn(e):e.type===`keydown`||e.type===`keyup`?e.keyCode:0}})),Fn=mn(m({},Sn,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0})),In=mn(m({},_n,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Nn})),Ln=mn(m({},hn,{propertyName:0,elapsedTime:0,pseudoElement:0})),Rn=mn(m({},Sn,{deltaX:function(e){return`deltaX`in e?e.deltaX:`wheelDeltaX`in e?-e.wheelDeltaX:0},deltaY:function(e){return`deltaY`in e?e.deltaY:`wheelDeltaY`in e?-e.wheelDeltaY:`wheelDelta`in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0})),zn=mn(m({},hn,{newState:0,oldState:0})),Bn=[9,13,27,32],Vn=rn&&`CompositionEvent`in window,Hn=null;rn&&`documentMode`in document&&(Hn=document.documentMode);var Un=rn&&`TextEvent`in window&&!Hn,Wn=rn&&(!Vn||Hn&&8<Hn&&11>=Hn),Gn=` `,Kn=!1;function qn(e,t){switch(e){case`keyup`:return Bn.indexOf(t.keyCode)!==-1;case`keydown`:return t.keyCode!==229;case`keypress`:case`mousedown`:case`focusout`:return!0;default:return!1}}function Jn(e){return e=e.detail,typeof e==`object`&&`data`in e?e.data:null}var Yn=!1;function Xn(e,t){switch(e){case`compositionend`:return Jn(t);case`keypress`:return t.which===32?(Kn=!0,Gn):null;case`textInput`:return e=t.data,e===Gn&&Kn?null:e;default:return null}}function Zn(e,t){if(Yn)return e===`compositionend`||!Vn&&qn(e,t)?(e=un(),ln=cn=sn=null,Yn=!1,e):null;switch(e){case`paste`:return null;case`keypress`:if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case`compositionend`:return Wn&&t.locale!==`ko`?null:t.data;default:return null}}var Qn={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function $n(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t===`input`?!!Qn[e.type]:t===`textarea`}function er(e,t,n,r){Zt?Qt?Qt.push(r):Qt=[r]:Zt=r,t=kd(t,`onChange`),0<t.length&&(n=new gn(`onChange`,`change`,null,n,r),e.push({event:n,listeners:t}))}var tr=null,nr=null;function rr(e){Sd(e,0)}function ir(e){if(At(ft(e)))return e}function ar(e,t){if(e===`change`)return t}var or=!1;if(rn){var sr;if(rn){var cr=`oninput`in document;if(!cr){var lr=document.createElement(`div`);lr.setAttribute(`oninput`,`return;`),cr=typeof lr.oninput==`function`}sr=cr}else sr=!1;or=sr&&(!document.documentMode||9<document.documentMode)}function ur(){tr&&(tr.detachEvent(`onpropertychange`,dr),nr=tr=null)}function dr(e){if(e.propertyName===`value`&&ir(nr)){var t=[];er(t,nr,e,Xt(e)),tn(rr,t)}}function fr(e,t,n){e===`focusin`?(ur(),tr=t,nr=n,tr.attachEvent(`onpropertychange`,dr)):e===`focusout`&&ur()}function pr(e){if(e===`selectionchange`||e===`keyup`||e===`keydown`)return ir(nr)}function mr(e,t){if(e===`click`)return ir(t)}function hr(e,t){if(e===`input`||e===`change`)return ir(t)}function gr(e,t){return e===t&&(e!==0||1/e==1/t)||e!==e&&t!==t}var _r=typeof Object.is==`function`?Object.is:gr;function vr(e,t){if(_r(e,t))return!0;if(typeof e!=`object`||!e||typeof t!=`object`||!t)return!1;var n=Object.keys(e),r=Object.keys(t);if(n.length!==r.length)return!1;for(r=0;r<n.length;r++){var i=n[r];if(!ge.call(t,i)||!_r(e[i],t[i]))return!1}return!0}function yr(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function br(e,t){var n=yr(e);e=0;for(var r;n;){if(n.nodeType===3){if(r=e+n.textContent.length,e<=t&&r>=t)return{node:n,offset:t-e};e=r}a:{for(;n;){if(n.nextSibling){n=n.nextSibling;break a}n=n.parentNode}n=void 0}n=yr(n)}}function xr(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?xr(e,t.parentNode):`contains`in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function Sr(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=jt(e.document);t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href==`string`}catch{n=!1}if(n)e=t.contentWindow;else break;t=jt(e.document)}return t}function Cr(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t===`input`&&(e.type===`text`||e.type===`search`||e.type===`tel`||e.type===`url`||e.type===`password`)||t===`textarea`||e.contentEditable===`true`)}var wr=rn&&`documentMode`in document&&11>=document.documentMode,Tr=null,Er=null,Dr=null,Or=!1;function kr(e,t,n){var r=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;Or||Tr==null||Tr!==jt(r)||(r=Tr,`selectionStart`in r&&Cr(r)?r={start:r.selectionStart,end:r.selectionEnd}:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection(),r={anchorNode:r.anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset}),Dr&&vr(Dr,r)||(Dr=r,r=kd(Er,`onSelect`),0<r.length&&(t=new gn(`onSelect`,`select`,null,t,n),e.push({event:t,listeners:r}),t.target=Tr)))}function Ar(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n[`Webkit`+e]=`webkit`+t,n[`Moz`+e]=`moz`+t,n}var jr={animationend:Ar(`Animation`,`AnimationEnd`),animationiteration:Ar(`Animation`,`AnimationIteration`),animationstart:Ar(`Animation`,`AnimationStart`),transitionrun:Ar(`Transition`,`TransitionRun`),transitionstart:Ar(`Transition`,`TransitionStart`),transitioncancel:Ar(`Transition`,`TransitionCancel`),transitionend:Ar(`Transition`,`TransitionEnd`)},Mr={},Nr={};rn&&(Nr=document.createElement(`div`).style,`AnimationEvent`in window||(delete jr.animationend.animation,delete jr.animationiteration.animation,delete jr.animationstart.animation),`TransitionEvent`in window||delete jr.transitionend.transition);function Pr(e){if(Mr[e])return Mr[e];if(!jr[e])return e;var t=jr[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in Nr)return Mr[e]=t[n];return e}var Fr=Pr(`animationend`),Ir=Pr(`animationiteration`),Lr=Pr(`animationstart`),Rr=Pr(`transitionrun`),zr=Pr(`transitionstart`),Br=Pr(`transitioncancel`),Vr=Pr(`transitionend`),Hr=new Map,Ur=`abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel`.split(` `);Ur.push(`scrollEnd`);function Wr(e,t){Hr.set(e,t),_t(t,[e])}var Gr=typeof reportError==`function`?reportError:function(e){if(typeof window==`object`&&typeof window.ErrorEvent==`function`){var t=new window.ErrorEvent(`error`,{bubbles:!0,cancelable:!0,message:typeof e==`object`&&e&&typeof e.message==`string`?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process==`object`&&typeof process.emit==`function`){process.emit(`uncaughtException`,e);return}console.error(e)},Kr=[],qr=0,Jr=0;function Yr(){for(var e=qr,t=Jr=qr=0;t<e;){var n=Kr[t];Kr[t++]=null;var r=Kr[t];Kr[t++]=null;var i=Kr[t];Kr[t++]=null;var a=Kr[t];if(Kr[t++]=null,r!==null&&i!==null){var o=r.pending;o===null?i.next=i:(i.next=o.next,o.next=i),r.pending=i}a!==0&&$r(n,i,a)}}function Xr(e,t,n,r){Kr[qr++]=e,Kr[qr++]=t,Kr[qr++]=n,Kr[qr++]=r,Jr|=r,e.lanes|=r,e=e.alternate,e!==null&&(e.lanes|=r)}function Zr(e,t,n,r){return Xr(e,t,n,r),ei(e)}function Qr(e,t){return Xr(e,null,null,t),ei(e)}function $r(e,t,n){e.lanes|=n;var r=e.alternate;r!==null&&(r.lanes|=n);for(var i=!1,a=e.return;a!==null;)a.childLanes|=n,r=a.alternate,r!==null&&(r.childLanes|=n),a.tag===22&&(e=a.stateNode,e===null||e._visibility&1||(i=!0)),e=a,a=a.return;return e.tag===3?(a=e.stateNode,i&&t!==null&&(i=31-Me(n),e=a.hiddenUpdates,r=e[i],r===null?e[i]=[t]:r.push(t),t.lane=n|536870912),a):null}function ei(e){if(50<pu)throw pu=0,mu=null,Error(i(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var ti={};function ni(e,t,n,r){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=r,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function ri(e,t,n,r){return new ni(e,t,n,r)}function ii(e){return e=e.prototype,!(!e||!e.isReactComponent)}function ai(e,t){var n=e.alternate;return n===null?(n=ri(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&65011712,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n.refCleanup=e.refCleanup,n}function oi(e,t){e.flags&=65011714;var n=e.alternate;return n===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=n.childLanes,e.lanes=n.lanes,e.child=n.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=n.memoizedProps,e.memoizedState=n.memoizedState,e.updateQueue=n.updateQueue,e.type=n.type,t=n.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function si(e,t,n,r,a,o){var s=0;if(r=e,typeof e==`function`)ii(e)&&(s=1);else if(typeof e==`string`)s=Gf(e,n,oe.current)?26:e===`html`||e===`head`||e===`body`?27:5;else a:switch(e){case k:return e=ri(31,n,t,a),e.elementType=k,e.lanes=o,e;case y:return ci(n.children,a,o,t);case b:s=8,a|=24;break;case x:return e=ri(12,n,t,a|2),e.elementType=x,e.lanes=o,e;case T:return e=ri(13,n,t,a),e.elementType=T,e.lanes=o,e;case E:return e=ri(19,n,t,a),e.elementType=E,e.lanes=o,e;default:if(typeof e==`object`&&e)switch(e.$$typeof){case C:s=10;break a;case S:s=9;break a;case w:s=11;break a;case D:s=14;break a;case O:s=16,r=null;break a}s=29,n=Error(i(130,e===null?`null`:typeof e,``)),r=null}return t=ri(s,n,t,a),t.elementType=e,t.type=r,t.lanes=o,t}function ci(e,t,n,r){return e=ri(7,e,r,t),e.lanes=n,e}function li(e,t,n){return e=ri(6,e,null,t),e.lanes=n,e}function ui(e){var t=ri(18,null,null,0);return t.stateNode=e,t}function di(e,t,n){return t=ri(4,e.children===null?[]:e.children,e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var fi=new WeakMap;function pi(e,t){if(typeof e==`object`&&e){var n=fi.get(e);return n===void 0?(t={value:e,source:t,stack:he(t)},fi.set(e,t),t):n}return{value:e,source:t,stack:he(t)}}var mi=[],hi=0,gi=null,_i=0,vi=[],yi=0,bi=null,xi=1,Si=``;function Ci(e,t){mi[hi++]=_i,mi[hi++]=gi,gi=e,_i=t}function wi(e,t,n){vi[yi++]=xi,vi[yi++]=Si,vi[yi++]=bi,bi=e;var r=xi;e=Si;var i=32-Me(r)-1;r&=~(1<<i),n+=1;var a=32-Me(t)+i;if(30<a){var o=i-i%5;a=(r&(1<<o)-1).toString(32),r>>=o,i-=o,xi=1<<32-Me(t)+i|n<<i|r,Si=a+e}else xi=1<<a|n<<i|r,Si=e}function Ti(e){e.return!==null&&(Ci(e,1),wi(e,1,0))}function Ei(e){for(;e===gi;)gi=mi[--hi],mi[hi]=null,_i=mi[--hi],mi[hi]=null;for(;e===bi;)bi=vi[--yi],vi[yi]=null,Si=vi[--yi],vi[yi]=null,xi=vi[--yi],vi[yi]=null}function Di(e,t){vi[yi++]=xi,vi[yi++]=Si,vi[yi++]=bi,xi=t.id,Si=t.overflow,bi=e}var Oi=null,ki=null,Ai=!1,ji=null,Mi=!1,Ni=Error(i(519));function Pi(e){throw Bi(pi(Error(i(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?`text`:`HTML`,``)),e)),Ni}function Fi(e){var t=e.stateNode,n=e.type,r=e.memoizedProps;switch(t[tt]=e,t[nt]=r,n){case`dialog`:Y(`cancel`,t),Y(`close`,t);break;case`iframe`:case`object`:case`embed`:Y(`load`,t);break;case`video`:case`audio`:for(n=0;n<bd.length;n++)Y(bd[n],t);break;case`source`:Y(`error`,t);break;case`img`:case`image`:case`link`:Y(`error`,t),Y(`load`,t);break;case`details`:Y(`toggle`,t);break;case`input`:Y(`invalid`,t),Ft(t,r.value,r.defaultValue,r.checked,r.defaultChecked,r.type,r.name,!0);break;case`select`:Y(`invalid`,t);break;case`textarea`:Y(`invalid`,t),zt(t,r.value,r.defaultValue,r.children)}n=r.children,typeof n!=`string`&&typeof n!=`number`&&typeof n!=`bigint`||t.textContent===``+n||!0===r.suppressHydrationWarning||Fd(t.textContent,n)?(r.popover!=null&&(Y(`beforetoggle`,t),Y(`toggle`,t)),r.onScroll!=null&&Y(`scroll`,t),r.onScrollEnd!=null&&Y(`scrollend`,t),r.onClick!=null&&(t.onclick=Jt),t=!0):t=!1,t||Pi(e,!0)}function Ii(e){for(Oi=e.return;Oi;)switch(Oi.tag){case 5:case 31:case 13:Mi=!1;return;case 27:case 3:Mi=!0;return;default:Oi=Oi.return}}function Li(e){if(e!==Oi)return!1;if(!Ai)return Ii(e),Ai=!0,!1;var t=e.tag,n;if((n=t!==3&&t!==27)&&((n=t===5)&&(n=e.type,n=!(n!==`form`&&n!==`button`)||qd(e.type,e.memoizedProps)),n=!n),n&&ki&&Pi(e),Ii(e),t===13){if(e=e.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(317));ki=ff(e)}else if(t===31){if(e=e.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(317));ki=ff(e)}else t===27?(t=ki,tf(e.type)?(e=df,df=null,ki=e):ki=t):ki=Oi?uf(e.stateNode.nextSibling):null;return!0}function Ri(){ki=Oi=null,Ai=!1}function zi(){var e=ji;return e!==null&&($l===null?$l=e:$l.push.apply($l,e),ji=null),e}function Bi(e){ji===null?ji=[e]:ji.push(e)}var Vi=I(null),Hi=null,Ui=null;function Wi(e,t,n){L(Vi,t._currentValue),t._currentValue=n}function Gi(e){e._currentValue=Vi.current,ae(Vi)}function Ki(e,t,n){for(;e!==null;){var r=e.alternate;if((e.childLanes&t)===t?r!==null&&(r.childLanes&t)!==t&&(r.childLanes|=t):(e.childLanes|=t,r!==null&&(r.childLanes|=t)),e===n)break;e=e.return}}function qi(e,t,n,r){var a=e.child;for(a!==null&&(a.return=e);a!==null;){var o=a.dependencies;if(o!==null){var s=a.child;o=o.firstContext;a:for(;o!==null;){var c=o;o=a;for(var l=0;l<t.length;l++)if(c.context===t[l]){o.lanes|=n,c=o.alternate,c!==null&&(c.lanes|=n),Ki(o.return,n,e),r||(s=null);break a}o=c.next}}else if(a.tag===18){if(s=a.return,s===null)throw Error(i(341));s.lanes|=n,o=s.alternate,o!==null&&(o.lanes|=n),Ki(s,n,e),s=null}else s=a.child;if(s!==null)s.return=a;else for(s=a;s!==null;){if(s===e){s=null;break}if(a=s.sibling,a!==null){a.return=s.return,s=a;break}s=s.return}a=s}}function Ji(e,t,n,r){e=null;for(var a=t,o=!1;a!==null;){if(!o){if(a.flags&524288)o=!0;else if(a.flags&262144)break}if(a.tag===10){var s=a.alternate;if(s===null)throw Error(i(387));if(s=s.memoizedProps,s!==null){var c=a.type;_r(a.pendingProps.value,s.value)||(e===null?e=[c]:e.push(c))}}else if(a===le.current){if(s=a.alternate,s===null)throw Error(i(387));s.memoizedState.memoizedState!==a.memoizedState.memoizedState&&(e===null?e=[ep]:e.push(ep))}a=a.return}e!==null&&qi(t,e,n,r),t.flags|=262144}function Yi(e){for(e=e.firstContext;e!==null;){if(!_r(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function Xi(e){Hi=e,Ui=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function Zi(e){return $i(Hi,e)}function Qi(e,t){return Hi===null&&Xi(e),$i(e,t)}function $i(e,t){var n=t._currentValue;if(t={context:t,memoizedValue:n,next:null},Ui===null){if(e===null)throw Error(i(308));Ui=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else Ui=Ui.next=t;return n}var ea=typeof AbortController<`u`?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(t,n){e.push(n)}};this.abort=function(){t.aborted=!0,e.forEach(function(e){return e()})}},ta=t.unstable_scheduleCallback,na=t.unstable_NormalPriority,ra={$$typeof:C,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function ia(){return{controller:new ea,data:new Map,refCount:0}}function aa(e){e.refCount--,e.refCount===0&&ta(na,function(){e.controller.abort()})}var oa=null,sa=0,ca=0,la=null;function ua(e,t){if(oa===null){var n=oa=[];sa=0,ca=md(),la={status:`pending`,value:void 0,then:function(e){n.push(e)}}}return sa++,t.then(da,da),t}function da(){if(--sa===0&&oa!==null){la!==null&&(la.status=`fulfilled`);var e=oa;oa=null,ca=0,la=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function fa(e,t){var n=[],r={status:`pending`,value:null,reason:null,then:function(e){n.push(e)}};return e.then(function(){r.status=`fulfilled`,r.value=t;for(var e=0;e<n.length;e++)(0,n[e])(t)},function(e){for(r.status=`rejected`,r.reason=e,e=0;e<n.length;e++)(0,n[e])(void 0)}),r}var pa=P.S;P.S=function(e,t){nu=be(),typeof t==`object`&&t&&typeof t.then==`function`&&ua(e,t),pa!==null&&pa(e,t)};var ma=I(null);function ha(){var e=ma.current;return e===null?zl.pooledCache:e}function ga(e,t){t===null?L(ma,ma.current):L(ma,t.pool)}function _a(){var e=ha();return e===null?null:{parent:ra._currentValue,pool:e}}var va=Error(i(460)),ya=Error(i(474)),ba=Error(i(542)),xa={then:function(){}};function Sa(e){return e=e.status,e===`fulfilled`||e===`rejected`}function Ca(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(Jt,Jt),t=n),t.status){case`fulfilled`:return t.value;case`rejected`:throw e=t.reason,Ea(e),e;default:if(typeof t.status==`string`)t.then(Jt,Jt);else{if(e=zl,e!==null&&100<e.shellSuspendCounter)throw Error(i(482));e=t,e.status=`pending`,e.then(function(e){if(t.status===`pending`){var n=t;n.status=`fulfilled`,n.value=e}},function(e){if(t.status===`pending`){var n=t;n.status=`rejected`,n.reason=e}})}switch(t.status){case`fulfilled`:return t.value;case`rejected`:throw e=t.reason,Ea(e),e}throw Ta=t,va}}function wa(e){try{var t=e._init;return t(e._payload)}catch(e){throw typeof e==`object`&&e&&typeof e.then==`function`?(Ta=e,va):e}}var Ta=null;function W(){if(Ta===null)throw Error(i(459));var e=Ta;return Ta=null,e}function Ea(e){if(e===va||e===ba)throw Error(i(483))}var Da=null,Oa=0;function ka(e){var t=Oa;return Oa+=1,Da===null&&(Da=[]),Ca(Da,e,t)}function Aa(e,t){t=t.props.ref,e.ref=t===void 0?null:t}function ja(e,t){throw t.$$typeof===g?Error(i(525)):(e=Object.prototype.toString.call(t),Error(i(31,e===`[object Object]`?`object with keys {`+Object.keys(t).join(`, `)+`}`:e)))}function Ma(e){function t(t,n){if(e){var r=t.deletions;r===null?(t.deletions=[n],t.flags|=16):r.push(n)}}function n(n,r){if(!e)return null;for(;r!==null;)t(n,r),r=r.sibling;return null}function r(e){for(var t=new Map;e!==null;)e.key===null?t.set(e.index,e):t.set(e.key,e),e=e.sibling;return t}function a(e,t){return e=ai(e,t),e.index=0,e.sibling=null,e}function o(t,n,r){return t.index=r,e?(r=t.alternate,r===null?(t.flags|=67108866,n):(r=r.index,r<n?(t.flags|=67108866,n):r)):(t.flags|=1048576,n)}function s(t){return e&&t.alternate===null&&(t.flags|=67108866),t}function c(e,t,n,r){return t===null||t.tag!==6?(t=li(n,e.mode,r),t.return=e,t):(t=a(t,n),t.return=e,t)}function l(e,t,n,r){var i=n.type;return i===y?d(e,t,n.props.children,r,n.key):t!==null&&(t.elementType===i||typeof i==`object`&&i&&i.$$typeof===O&&wa(i)===t.type)?(t=a(t,n.props),Aa(t,n),t.return=e,t):(t=si(n.type,n.key,n.props,null,e.mode,r),Aa(t,n),t.return=e,t)}function u(e,t,n,r){return t===null||t.tag!==4||t.stateNode.containerInfo!==n.containerInfo||t.stateNode.implementation!==n.implementation?(t=di(n,e.mode,r),t.return=e,t):(t=a(t,n.children||[]),t.return=e,t)}function d(e,t,n,r,i){return t===null||t.tag!==7?(t=ci(n,e.mode,r,i),t.return=e,t):(t=a(t,n),t.return=e,t)}function f(e,t,n){if(typeof t==`string`&&t!==``||typeof t==`number`||typeof t==`bigint`)return t=li(``+t,e.mode,n),t.return=e,t;if(typeof t==`object`&&t){switch(t.$$typeof){case _:return n=si(t.type,t.key,t.props,null,e.mode,n),Aa(n,t),n.return=e,n;case v:return t=di(t,e.mode,n),t.return=e,t;case O:return t=wa(t),f(e,t,n)}if(N(t)||j(t))return t=ci(t,e.mode,n,null),t.return=e,t;if(typeof t.then==`function`)return f(e,ka(t),n);if(t.$$typeof===C)return f(e,Qi(e,t),n);ja(e,t)}return null}function p(e,t,n,r){var i=t===null?null:t.key;if(typeof n==`string`&&n!==``||typeof n==`number`||typeof n==`bigint`)return i===null?c(e,t,``+n,r):null;if(typeof n==`object`&&n){switch(n.$$typeof){case _:return n.key===i?l(e,t,n,r):null;case v:return n.key===i?u(e,t,n,r):null;case O:return n=wa(n),p(e,t,n,r)}if(N(n)||j(n))return i===null?d(e,t,n,r,null):null;if(typeof n.then==`function`)return p(e,t,ka(n),r);if(n.$$typeof===C)return p(e,t,Qi(e,n),r);ja(e,n)}return null}function m(e,t,n,r,i){if(typeof r==`string`&&r!==``||typeof r==`number`||typeof r==`bigint`)return e=e.get(n)||null,c(t,e,``+r,i);if(typeof r==`object`&&r){switch(r.$$typeof){case _:return e=e.get(r.key===null?n:r.key)||null,l(t,e,r,i);case v:return e=e.get(r.key===null?n:r.key)||null,u(t,e,r,i);case O:return r=wa(r),m(e,t,n,r,i)}if(N(r)||j(r))return e=e.get(n)||null,d(t,e,r,i,null);if(typeof r.then==`function`)return m(e,t,n,ka(r),i);if(r.$$typeof===C)return m(e,t,n,Qi(t,r),i);ja(t,r)}return null}function h(i,a,s,c){for(var l=null,u=null,d=a,h=a=0,g=null;d!==null&&h<s.length;h++){d.index>h?(g=d,d=null):g=d.sibling;var _=p(i,d,s[h],c);if(_===null){d===null&&(d=g);break}e&&d&&_.alternate===null&&t(i,d),a=o(_,a,h),u===null?l=_:u.sibling=_,u=_,d=g}if(h===s.length)return n(i,d),Ai&&Ci(i,h),l;if(d===null){for(;h<s.length;h++)d=f(i,s[h],c),d!==null&&(a=o(d,a,h),u===null?l=d:u.sibling=d,u=d);return Ai&&Ci(i,h),l}for(d=r(d);h<s.length;h++)g=m(d,i,h,s[h],c),g!==null&&(e&&g.alternate!==null&&d.delete(g.key===null?h:g.key),a=o(g,a,h),u===null?l=g:u.sibling=g,u=g);return e&&d.forEach(function(e){return t(i,e)}),Ai&&Ci(i,h),l}function g(a,s,c,l){if(c==null)throw Error(i(151));for(var u=null,d=null,h=s,g=s=0,_=null,v=c.next();h!==null&&!v.done;g++,v=c.next()){h.index>g?(_=h,h=null):_=h.sibling;var y=p(a,h,v.value,l);if(y===null){h===null&&(h=_);break}e&&h&&y.alternate===null&&t(a,h),s=o(y,s,g),d===null?u=y:d.sibling=y,d=y,h=_}if(v.done)return n(a,h),Ai&&Ci(a,g),u;if(h===null){for(;!v.done;g++,v=c.next())v=f(a,v.value,l),v!==null&&(s=o(v,s,g),d===null?u=v:d.sibling=v,d=v);return Ai&&Ci(a,g),u}for(h=r(h);!v.done;g++,v=c.next())v=m(h,a,g,v.value,l),v!==null&&(e&&v.alternate!==null&&h.delete(v.key===null?g:v.key),s=o(v,s,g),d===null?u=v:d.sibling=v,d=v);return e&&h.forEach(function(e){return t(a,e)}),Ai&&Ci(a,g),u}function b(e,r,o,c){if(typeof o==`object`&&o&&o.type===y&&o.key===null&&(o=o.props.children),typeof o==`object`&&o){switch(o.$$typeof){case _:a:{for(var l=o.key;r!==null;){if(r.key===l){if(l=o.type,l===y){if(r.tag===7){n(e,r.sibling),c=a(r,o.props.children),c.return=e,e=c;break a}}else if(r.elementType===l||typeof l==`object`&&l&&l.$$typeof===O&&wa(l)===r.type){n(e,r.sibling),c=a(r,o.props),Aa(c,o),c.return=e,e=c;break a}n(e,r);break}else t(e,r);r=r.sibling}o.type===y?(c=ci(o.props.children,e.mode,c,o.key),c.return=e,e=c):(c=si(o.type,o.key,o.props,null,e.mode,c),Aa(c,o),c.return=e,e=c)}return s(e);case v:a:{for(l=o.key;r!==null;){if(r.key===l)if(r.tag===4&&r.stateNode.containerInfo===o.containerInfo&&r.stateNode.implementation===o.implementation){n(e,r.sibling),c=a(r,o.children||[]),c.return=e,e=c;break a}else{n(e,r);break}else t(e,r);r=r.sibling}c=di(o,e.mode,c),c.return=e,e=c}return s(e);case O:return o=wa(o),b(e,r,o,c)}if(N(o))return h(e,r,o,c);if(j(o)){if(l=j(o),typeof l!=`function`)throw Error(i(150));return o=l.call(o),g(e,r,o,c)}if(typeof o.then==`function`)return b(e,r,ka(o),c);if(o.$$typeof===C)return b(e,r,Qi(e,o),c);ja(e,o)}return typeof o==`string`&&o!==``||typeof o==`number`||typeof o==`bigint`?(o=``+o,r!==null&&r.tag===6?(n(e,r.sibling),c=a(r,o),c.return=e,e=c):(n(e,r),c=li(o,e.mode,c),c.return=e,e=c),s(e)):n(e,r)}return function(e,t,n,r){try{Oa=0;var i=b(e,t,n,r);return Da=null,i}catch(t){if(t===va||t===ba)throw t;var a=ri(29,t,null,e.mode);return a.lanes=r,a.return=e,a}}}var Na=Ma(!0),Pa=Ma(!1),Fa=!1;function Ia(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function La(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function Ra(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function za(e,t,n){var r=e.updateQueue;if(r===null)return null;if(r=r.shared,Rl&2){var i=r.pending;return i===null?t.next=t:(t.next=i.next,i.next=t),r.pending=t,t=ei(e),$r(e,null,n),t}return Xr(e,r,t,n),ei(e)}function Ba(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,n&4194048)){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,Je(e,n)}}function Va(e,t){var n=e.updateQueue,r=e.alternate;if(r!==null&&(r=r.updateQueue,n===r)){var i=null,a=null;if(n=n.firstBaseUpdate,n!==null){do{var o={lane:n.lane,tag:n.tag,payload:n.payload,callback:null,next:null};a===null?i=a=o:a=a.next=o,n=n.next}while(n!==null);a===null?i=a=t:a=a.next=t}else i=a=t;n={baseState:r.baseState,firstBaseUpdate:i,lastBaseUpdate:a,shared:r.shared,callbacks:r.callbacks},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}var Ha=!1;function Ua(){if(Ha){var e=la;if(e!==null)throw e}}function Wa(e,t,n,r){Ha=!1;var i=e.updateQueue;Fa=!1;var a=i.firstBaseUpdate,o=i.lastBaseUpdate,s=i.shared.pending;if(s!==null){i.shared.pending=null;var c=s,l=c.next;c.next=null,o===null?a=l:o.next=l,o=c;var u=e.alternate;u!==null&&(u=u.updateQueue,s=u.lastBaseUpdate,s!==o&&(s===null?u.firstBaseUpdate=l:s.next=l,u.lastBaseUpdate=c))}if(a!==null){var d=i.baseState;o=0,u=l=c=null,s=a;do{var f=s.lane&-536870913,p=f!==s.lane;if(p?(J&f)===f:(r&f)===f){f!==0&&f===ca&&(Ha=!0),u!==null&&(u=u.next={lane:0,tag:s.tag,payload:s.payload,callback:null,next:null});a:{var h=e,g=s;f=t;var _=n;switch(g.tag){case 1:if(h=g.payload,typeof h==`function`){d=h.call(_,d,f);break a}d=h;break a;case 3:h.flags=h.flags&-65537|128;case 0:if(h=g.payload,f=typeof h==`function`?h.call(_,d,f):h,f==null)break a;d=m({},d,f);break a;case 2:Fa=!0}}f=s.callback,f!==null&&(e.flags|=64,p&&(e.flags|=8192),p=i.callbacks,p===null?i.callbacks=[f]:p.push(f))}else p={lane:f,tag:s.tag,payload:s.payload,callback:s.callback,next:null},u===null?(l=u=p,c=d):u=u.next=p,o|=f;if(s=s.next,s===null){if(s=i.shared.pending,s===null)break;p=s,s=p.next,p.next=null,i.lastBaseUpdate=p,i.shared.pending=null}}while(1);u===null&&(c=d),i.baseState=c,i.firstBaseUpdate=l,i.lastBaseUpdate=u,a===null&&(i.shared.lanes=0),ql|=o,e.lanes=o,e.memoizedState=d}}function Ga(e,t){if(typeof e!=`function`)throw Error(i(191,e));e.call(t)}function Ka(e,t){var n=e.callbacks;if(n!==null)for(e.callbacks=null,e=0;e<n.length;e++)Ga(n[e],t)}var qa=I(null),Ja=I(0);function Ya(e,t){e=Gl,L(Ja,e),L(qa,t),Gl=e|t.baseLanes}function Xa(){L(Ja,Gl),L(qa,qa.current)}function Za(){Gl=Ja.current,ae(qa),ae(Ja)}var Qa=I(null),$a=null;function eo(e){var t=e.alternate;L(ao,ao.current&1),L(Qa,e),$a===null&&(t===null||qa.current!==null||t.memoizedState!==null)&&($a=e)}function to(e){L(ao,ao.current),L(Qa,e),$a===null&&($a=e)}function no(e){e.tag===22?(L(ao,ao.current),L(Qa,e),$a===null&&($a=e)):ro(e)}function ro(){L(ao,ao.current),L(Qa,Qa.current)}function io(e){ae(Qa),$a===e&&($a=null),ae(ao)}var ao=I(0);function oo(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||cf(n)||Z(n)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder===`forwards`||t.memoizedProps.revealOrder===`backwards`||t.memoizedProps.revealOrder===`unstable_legacy-backwards`||t.memoizedProps.revealOrder===`together`)){if(t.flags&128)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var so=0,G=null,co=null,lo=null,uo=!1,fo=!1,po=!1,mo=0,ho=0,go=null,_o=0;function vo(){throw Error(i(321))}function yo(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!_r(e[n],t[n]))return!1;return!0}function bo(e,t,n,r,i,a){return so=a,G=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,P.H=e===null||e.memoizedState===null?Ls:Rs,po=!1,a=n(r,i),po=!1,fo&&(a=So(t,n,r,i)),xo(e),a}function xo(e){P.H=Is;var t=co!==null&&co.next!==null;if(so=0,lo=co=G=null,uo=!1,ho=0,go=null,t)throw Error(i(300));e===null||tc||(e=e.dependencies,e!==null&&Yi(e)&&(tc=!0))}function So(e,t,n,r){G=e;var a=0;do{if(fo&&(go=null),ho=0,fo=!1,25<=a)throw Error(i(301));if(a+=1,lo=co=null,e.updateQueue!=null){var o=e.updateQueue;o.lastEffect=null,o.events=null,o.stores=null,o.memoCache!=null&&(o.memoCache.index=0)}P.H=zs,o=t(n,r)}while(fo);return o}function Co(){var e=P.H,t=e.useState()[0];return t=typeof t.then==`function`?Ao(t):t,e=e.useState()[0],(co===null?null:co.memoizedState)!==e&&(G.flags|=1024),t}function wo(){var e=mo!==0;return mo=0,e}function To(e,t,n){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~n}function Eo(e){if(uo){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}uo=!1}so=0,lo=co=G=null,fo=!1,ho=mo=0,go=null}function Do(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return lo===null?G.memoizedState=lo=e:lo=lo.next=e,lo}function Oo(){if(co===null){var e=G.alternate;e=e===null?null:e.memoizedState}else e=co.next;var t=lo===null?G.memoizedState:lo.next;if(t!==null)lo=t,co=e;else{if(e===null)throw G.alternate===null?Error(i(467)):Error(i(310));co=e,e={memoizedState:co.memoizedState,baseState:co.baseState,baseQueue:co.baseQueue,queue:co.queue,next:null},lo===null?G.memoizedState=lo=e:lo=lo.next=e}return lo}function ko(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function Ao(e){var t=ho;return ho+=1,go===null&&(go=[]),e=Ca(go,e,t),t=G,(lo===null?t.memoizedState:lo.next)===null&&(t=t.alternate,P.H=t===null||t.memoizedState===null?Ls:Rs),e}function jo(e){if(typeof e==`object`&&e){if(typeof e.then==`function`)return Ao(e);if(e.$$typeof===C)return Zi(e)}throw Error(i(438,String(e)))}function Mo(e){var t=null,n=G.updateQueue;if(n!==null&&(t=n.memoCache),t==null){var r=G.alternate;r!==null&&(r=r.updateQueue,r!==null&&(r=r.memoCache,r!=null&&(t={data:r.data.map(function(e){return e.slice()}),index:0})))}if(t??={data:[],index:0},n===null&&(n=ko(),G.updateQueue=n),n.memoCache=t,n=t.data[t.index],n===void 0)for(n=t.data[t.index]=Array(e),r=0;r<e;r++)n[r]=A;return t.index++,n}function No(e,t){return typeof t==`function`?t(e):t}function Po(e){return Fo(Oo(),co,e)}function Fo(e,t,n){var r=e.queue;if(r===null)throw Error(i(311));r.lastRenderedReducer=n;var a=e.baseQueue,o=r.pending;if(o!==null){if(a!==null){var s=a.next;a.next=o.next,o.next=s}t.baseQueue=a=o,r.pending=null}if(o=e.baseState,a===null)e.memoizedState=o;else{t=a.next;var c=s=null,l=null,u=t,d=!1;do{var f=u.lane&-536870913;if(f===u.lane?(so&f)===f:(J&f)===f){var p=u.revertLane;if(p===0)l!==null&&(l=l.next={lane:0,revertLane:0,gesture:null,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null}),f===ca&&(d=!0);else if((so&p)===p){u=u.next,p===ca&&(d=!0);continue}else f={lane:0,revertLane:u.revertLane,gesture:null,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null},l===null?(c=l=f,s=o):l=l.next=f,G.lanes|=p,ql|=p;f=u.action,po&&n(o,f),o=u.hasEagerState?u.eagerState:n(o,f)}else p={lane:f,revertLane:u.revertLane,gesture:u.gesture,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null},l===null?(c=l=p,s=o):l=l.next=p,G.lanes|=f,ql|=f;u=u.next}while(u!==null&&u!==t);if(l===null?s=o:l.next=c,!_r(o,e.memoizedState)&&(tc=!0,d&&(n=la,n!==null)))throw n;e.memoizedState=o,e.baseState=s,e.baseQueue=l,r.lastRenderedState=o}return a===null&&(r.lanes=0),[e.memoizedState,r.dispatch]}function Io(e){var t=Oo(),n=t.queue;if(n===null)throw Error(i(311));n.lastRenderedReducer=e;var r=n.dispatch,a=n.pending,o=t.memoizedState;if(a!==null){n.pending=null;var s=a=a.next;do o=e(o,s.action),s=s.next;while(s!==a);_r(o,t.memoizedState)||(tc=!0),t.memoizedState=o,t.baseQueue===null&&(t.baseState=o),n.lastRenderedState=o}return[o,r]}function Lo(e,t,n){var r=G,a=Oo(),o=Ai;if(o){if(n===void 0)throw Error(i(407));n=n()}else n=t();var s=!_r((co||a).memoizedState,n);if(s&&(a.memoizedState=n,tc=!0),a=a.queue,cs(Bo.bind(null,r,a,e),[e]),a.getSnapshot!==t||s||lo!==null&&lo.memoizedState.tag&1){if(r.flags|=2048,rs(9,{destroy:void 0},zo.bind(null,r,a,n,t),null),zl===null)throw Error(i(349));o||so&127||Ro(r,t,n)}return n}function Ro(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=G.updateQueue,t===null?(t=ko(),G.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function zo(e,t,n,r){t.value=n,t.getSnapshot=r,Vo(t)&&Ho(e)}function Bo(e,t,n){return n(function(){Vo(t)&&Ho(e)})}function Vo(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!_r(e,n)}catch{return!0}}function Ho(e){var t=Qr(e,2);t!==null&&_u(t,e,2)}function Uo(e){var t=Do();if(typeof e==`function`){var n=e;if(e=n(),po){je(!0);try{n()}finally{je(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:No,lastRenderedState:e},t}function Wo(e,t,n,r){return e.baseState=n,Fo(e,co,typeof r==`function`?r:No)}function Go(e,t,n,r,a){if(Ns(e))throw Error(i(485));if(e=t.action,e!==null){var o={payload:a,action:e,next:null,isTransition:!0,status:`pending`,value:null,reason:null,listeners:[],then:function(e){o.listeners.push(e)}};P.T===null?o.isTransition=!1:n(!0),r(o),n=t.pending,n===null?(o.next=t.pending=o,Ko(t,o)):(o.next=n.next,t.pending=n.next=o)}}function Ko(e,t){var n=t.action,r=t.payload,i=e.state;if(t.isTransition){var a=P.T,o={};P.T=o;try{var s=n(i,r),c=P.S;c!==null&&c(o,s),qo(e,t,s)}catch(n){Yo(e,t,n)}finally{a!==null&&o.types!==null&&(a.types=o.types),P.T=a}}else try{a=n(i,r),qo(e,t,a)}catch(n){Yo(e,t,n)}}function qo(e,t,n){typeof n==`object`&&n&&typeof n.then==`function`?n.then(function(n){Jo(e,t,n)},function(n){return Yo(e,t,n)}):Jo(e,t,n)}function Jo(e,t,n){t.status=`fulfilled`,t.value=n,Xo(t),e.state=n,t=e.pending,t!==null&&(n=t.next,n===t?e.pending=null:(n=n.next,t.next=n,Ko(e,n)))}function Yo(e,t,n){var r=e.pending;if(e.pending=null,r!==null){r=r.next;do t.status=`rejected`,t.reason=n,Xo(t),t=t.next;while(t!==r)}e.action=null}function Xo(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function Zo(e,t){return t}function Qo(e,t){if(Ai){var n=zl.formState;if(n!==null){a:{var r=G;if(Ai){if(ki){b:{for(var i=ki,a=Mi;i.nodeType!==8;){if(!a){i=null;break b}if(i=uf(i.nextSibling),i===null){i=null;break b}}a=i.data,i=a===`F!`||a===`F`?i:null}if(i){ki=uf(i.nextSibling),r=i.data===`F!`;break a}}Pi(r)}r=!1}r&&(t=n[0])}}return n=Do(),n.memoizedState=n.baseState=t,r={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Zo,lastRenderedState:t},n.queue=r,n=As.bind(null,G,r),r.dispatch=n,r=Uo(!1),a=Ms.bind(null,G,!1,r.queue),r=Do(),i={state:t,dispatch:null,action:e,pending:null},r.queue=i,n=Go.bind(null,G,i,a,n),i.dispatch=n,r.memoizedState=e,[t,n,!1]}function $o(e){return es(Oo(),co,e)}function es(e,t,n){if(t=Fo(e,t,Zo)[0],e=Po(No)[0],typeof t==`object`&&t&&typeof t.then==`function`)try{var r=Ao(t)}catch(e){throw e===va?ba:e}else r=t;t=Oo();var i=t.queue,a=i.dispatch;return n!==t.memoizedState&&(G.flags|=2048,rs(9,{destroy:void 0},ts.bind(null,i,n),null)),[r,a,e]}function ts(e,t){e.action=t}function ns(e){var t=Oo(),n=co;if(n!==null)return es(t,n,e);Oo(),t=t.memoizedState,n=Oo();var r=n.queue.dispatch;return n.memoizedState=e,[t,r,!1]}function rs(e,t,n,r){return e={tag:e,create:n,deps:r,inst:t,next:null},t=G.updateQueue,t===null&&(t=ko(),G.updateQueue=t),n=t.lastEffect,n===null?t.lastEffect=e.next=e:(r=n.next,n.next=e,e.next=r,t.lastEffect=e),e}function is(){return Oo().memoizedState}function as(e,t,n,r){var i=Do();G.flags|=e,i.memoizedState=rs(1|t,{destroy:void 0},n,r===void 0?null:r)}function os(e,t,n,r){var i=Oo();r=r===void 0?null:r;var a=i.memoizedState.inst;co!==null&&r!==null&&yo(r,co.memoizedState.deps)?i.memoizedState=rs(t,a,n,r):(G.flags|=e,i.memoizedState=rs(1|t,a,n,r))}function ss(e,t){as(8390656,8,e,t)}function cs(e,t){os(2048,8,e,t)}function ls(e){G.flags|=4;var t=G.updateQueue;if(t===null)t=ko(),G.updateQueue=t,t.events=[e];else{var n=t.events;n===null?t.events=[e]:n.push(e)}}function us(e){var t=Oo().memoizedState;return ls({ref:t,nextImpl:e}),function(){if(Rl&2)throw Error(i(440));return t.impl.apply(void 0,arguments)}}function ds(e,t){return os(4,2,e,t)}function fs(e,t){return os(4,4,e,t)}function ps(e,t){if(typeof t==`function`){e=e();var n=t(e);return function(){typeof n==`function`?n():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function ms(e,t,n){n=n==null?null:n.concat([e]),os(4,4,ps.bind(null,t,e),n)}function hs(){}function gs(e,t){var n=Oo();t=t===void 0?null:t;var r=n.memoizedState;return t!==null&&yo(t,r[1])?r[0]:(n.memoizedState=[e,t],e)}function _s(e,t){var n=Oo();t=t===void 0?null:t;var r=n.memoizedState;if(t!==null&&yo(t,r[1]))return r[0];if(r=e(),po){je(!0);try{e()}finally{je(!1)}}return n.memoizedState=[r,t],r}function vs(e,t,n){return n===void 0||so&1073741824&&!(J&261930)?e.memoizedState=t:(e.memoizedState=n,e=gu(),G.lanes|=e,ql|=e,n)}function ys(e,t,n,r){return _r(n,t)?n:qa.current===null?!(so&42)||so&1073741824&&!(J&261930)?(tc=!0,e.memoizedState=n):(e=gu(),G.lanes|=e,ql|=e,t):(e=vs(e,n,r),_r(e,t)||(tc=!0),e)}function bs(e,t,n,r,i){var a=F.p;F.p=a!==0&&8>a?a:8;var o=P.T,s={};P.T=s,Ms(e,!1,t,n);try{var c=i(),l=P.S;l!==null&&l(s,c),typeof c==`object`&&c&&typeof c.then==`function`?js(e,t,fa(c,r),hu(e)):js(e,t,r,hu(e))}catch(n){js(e,t,{then:function(){},status:`rejected`,reason:n},hu())}finally{F.p=a,o!==null&&s.types!==null&&(o.types=s.types),P.T=o}}function xs(){}function Ss(e,t,n,r){if(e.tag!==5)throw Error(i(476));var a=Cs(e).queue;bs(e,a,t,ne,n===null?xs:function(){return ws(e),n(r)})}function Cs(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:ne,baseState:ne,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:No,lastRenderedState:ne},next:null};var n={};return t.next={memoizedState:n,baseState:n,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:No,lastRenderedState:n},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function ws(e){var t=Cs(e);t.next===null&&(t=e.alternate.memoizedState),js(e,t.next.queue,{},hu())}function Ts(){return Zi(ep)}function Es(){return Oo().memoizedState}function Ds(){return Oo().memoizedState}function Os(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var n=hu();e=Ra(n);var r=za(t,e,n);r!==null&&(_u(r,t,n),Ba(r,t,n)),t={cache:ia()},e.payload=t;return}t=t.return}}function ks(e,t,n){var r=hu();n={lane:r,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},Ns(e)?Ps(t,n):(n=Zr(e,t,n,r),n!==null&&(_u(n,e,r),Fs(n,t,r)))}function As(e,t,n){js(e,t,n,hu())}function js(e,t,n,r){var i={lane:r,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null};if(Ns(e))Ps(t,i);else{var a=e.alternate;if(e.lanes===0&&(a===null||a.lanes===0)&&(a=t.lastRenderedReducer,a!==null))try{var o=t.lastRenderedState,s=a(o,n);if(i.hasEagerState=!0,i.eagerState=s,_r(s,o))return Xr(e,t,i,0),zl===null&&Yr(),!1}catch{}if(n=Zr(e,t,i,r),n!==null)return _u(n,e,r),Fs(n,t,r),!0}return!1}function Ms(e,t,n,r){if(r={lane:2,revertLane:md(),gesture:null,action:r,hasEagerState:!1,eagerState:null,next:null},Ns(e)){if(t)throw Error(i(479))}else t=Zr(e,n,r,2),t!==null&&_u(t,e,2)}function Ns(e){var t=e.alternate;return e===G||t!==null&&t===G}function Ps(e,t){fo=uo=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function Fs(e,t,n){if(n&4194048){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,Je(e,n)}}var Is={readContext:Zi,use:jo,useCallback:vo,useContext:vo,useEffect:vo,useImperativeHandle:vo,useLayoutEffect:vo,useInsertionEffect:vo,useMemo:vo,useReducer:vo,useRef:vo,useState:vo,useDebugValue:vo,useDeferredValue:vo,useTransition:vo,useSyncExternalStore:vo,useId:vo,useHostTransitionStatus:vo,useFormState:vo,useActionState:vo,useOptimistic:vo,useMemoCache:vo,useCacheRefresh:vo};Is.useEffectEvent=vo;var Ls={readContext:Zi,use:jo,useCallback:function(e,t){return Do().memoizedState=[e,t===void 0?null:t],e},useContext:Zi,useEffect:ss,useImperativeHandle:function(e,t,n){n=n==null?null:n.concat([e]),as(4194308,4,ps.bind(null,t,e),n)},useLayoutEffect:function(e,t){return as(4194308,4,e,t)},useInsertionEffect:function(e,t){as(4,2,e,t)},useMemo:function(e,t){var n=Do();t=t===void 0?null:t;var r=e();if(po){je(!0);try{e()}finally{je(!1)}}return n.memoizedState=[r,t],r},useReducer:function(e,t,n){var r=Do();if(n!==void 0){var i=n(t);if(po){je(!0);try{n(t)}finally{je(!1)}}}else i=t;return r.memoizedState=r.baseState=i,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:i},r.queue=e,e=e.dispatch=ks.bind(null,G,e),[r.memoizedState,e]},useRef:function(e){var t=Do();return e={current:e},t.memoizedState=e},useState:function(e){e=Uo(e);var t=e.queue,n=As.bind(null,G,t);return t.dispatch=n,[e.memoizedState,n]},useDebugValue:hs,useDeferredValue:function(e,t){return vs(Do(),e,t)},useTransition:function(){var e=Uo(!1);return e=bs.bind(null,G,e.queue,!0,!1),Do().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,n){var r=G,a=Do();if(Ai){if(n===void 0)throw Error(i(407));n=n()}else{if(n=t(),zl===null)throw Error(i(349));J&127||Ro(r,t,n)}a.memoizedState=n;var o={value:n,getSnapshot:t};return a.queue=o,ss(Bo.bind(null,r,o,e),[e]),r.flags|=2048,rs(9,{destroy:void 0},zo.bind(null,r,o,n,t),null),n},useId:function(){var e=Do(),t=zl.identifierPrefix;if(Ai){var n=Si,r=xi;n=(r&~(1<<32-Me(r)-1)).toString(32)+n,t=`_`+t+`R_`+n,n=mo++,0<n&&(t+=`H`+n.toString(32)),t+=`_`}else n=_o++,t=`_`+t+`r_`+n.toString(32)+`_`;return e.memoizedState=t},useHostTransitionStatus:Ts,useFormState:Qo,useActionState:Qo,useOptimistic:function(e){var t=Do();t.memoizedState=t.baseState=e;var n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=n,t=Ms.bind(null,G,!0,n),n.dispatch=t,[e,t]},useMemoCache:Mo,useCacheRefresh:function(){return Do().memoizedState=Os.bind(null,G)},useEffectEvent:function(e){var t=Do(),n={impl:e};return t.memoizedState=n,function(){if(Rl&2)throw Error(i(440));return n.impl.apply(void 0,arguments)}}},Rs={readContext:Zi,use:jo,useCallback:gs,useContext:Zi,useEffect:cs,useImperativeHandle:ms,useInsertionEffect:ds,useLayoutEffect:fs,useMemo:_s,useReducer:Po,useRef:is,useState:function(){return Po(No)},useDebugValue:hs,useDeferredValue:function(e,t){return ys(Oo(),co.memoizedState,e,t)},useTransition:function(){var e=Po(No)[0],t=Oo().memoizedState;return[typeof e==`boolean`?e:Ao(e),t]},useSyncExternalStore:Lo,useId:Es,useHostTransitionStatus:Ts,useFormState:$o,useActionState:$o,useOptimistic:function(e,t){return Wo(Oo(),co,e,t)},useMemoCache:Mo,useCacheRefresh:Ds};Rs.useEffectEvent=us;var zs={readContext:Zi,use:jo,useCallback:gs,useContext:Zi,useEffect:cs,useImperativeHandle:ms,useInsertionEffect:ds,useLayoutEffect:fs,useMemo:_s,useReducer:Io,useRef:is,useState:function(){return Io(No)},useDebugValue:hs,useDeferredValue:function(e,t){var n=Oo();return co===null?vs(n,e,t):ys(n,co.memoizedState,e,t)},useTransition:function(){var e=Io(No)[0],t=Oo().memoizedState;return[typeof e==`boolean`?e:Ao(e),t]},useSyncExternalStore:Lo,useId:Es,useHostTransitionStatus:Ts,useFormState:ns,useActionState:ns,useOptimistic:function(e,t){var n=Oo();return co===null?(n.baseState=e,[e,n.queue.dispatch]):Wo(n,co,e,t)},useMemoCache:Mo,useCacheRefresh:Ds};zs.useEffectEvent=us;function Bs(e,t,n,r){t=e.memoizedState,n=n(r,t),n=n==null?t:m({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var Vs={enqueueSetState:function(e,t,n){e=e._reactInternals;var r=hu(),i=Ra(r);i.payload=t,n!=null&&(i.callback=n),t=za(e,i,r),t!==null&&(_u(t,e,r),Ba(t,e,r))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var r=hu(),i=Ra(r);i.tag=1,i.payload=t,n!=null&&(i.callback=n),t=za(e,i,r),t!==null&&(_u(t,e,r),Ba(t,e,r))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=hu(),r=Ra(n);r.tag=2,t!=null&&(r.callback=t),t=za(e,r,n),t!==null&&(_u(t,e,n),Ba(t,e,n))}};function Hs(e,t,n,r,i,a,o){return e=e.stateNode,typeof e.shouldComponentUpdate==`function`?e.shouldComponentUpdate(r,a,o):t.prototype&&t.prototype.isPureReactComponent?!vr(n,r)||!vr(i,a):!0}function Us(e,t,n,r){e=t.state,typeof t.componentWillReceiveProps==`function`&&t.componentWillReceiveProps(n,r),typeof t.UNSAFE_componentWillReceiveProps==`function`&&t.UNSAFE_componentWillReceiveProps(n,r),t.state!==e&&Vs.enqueueReplaceState(t,t.state,null)}function Ws(e,t){var n=t;if(`ref`in t)for(var r in n={},t)r!==`ref`&&(n[r]=t[r]);if(e=e.defaultProps)for(var i in n===t&&(n=m({},n)),e)n[i]===void 0&&(n[i]=e[i]);return n}function Gs(e){Gr(e)}function Ks(e){console.error(e)}function qs(e){Gr(e)}function Js(e,t){try{var n=e.onUncaughtError;n(t.value,{componentStack:t.stack})}catch(e){setTimeout(function(){throw e})}}function Ys(e,t,n){try{var r=e.onCaughtError;r(n.value,{componentStack:n.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(e){setTimeout(function(){throw e})}}function Xs(e,t,n){return n=Ra(n),n.tag=3,n.payload={element:null},n.callback=function(){Js(e,t)},n}function Zs(e){return e=Ra(e),e.tag=3,e}function Qs(e,t,n,r){var i=n.type.getDerivedStateFromError;if(typeof i==`function`){var a=r.value;e.payload=function(){return i(a)},e.callback=function(){Ys(t,n,r)}}var o=n.stateNode;o!==null&&typeof o.componentDidCatch==`function`&&(e.callback=function(){Ys(t,n,r),typeof i!=`function`&&(au===null?au=new Set([this]):au.add(this));var e=r.stack;this.componentDidCatch(r.value,{componentStack:e===null?``:e})})}function $s(e,t,n,r,a){if(n.flags|=32768,typeof r==`object`&&r&&typeof r.then==`function`){if(t=n.alternate,t!==null&&Ji(t,n,a,!0),n=Qa.current,n!==null){switch(n.tag){case 31:case 13:return $a===null?ku():n.alternate===null&&Kl===0&&(Kl=3),n.flags&=-257,n.flags|=65536,n.lanes=a,r===xa?n.flags|=16384:(t=n.updateQueue,t===null?n.updateQueue=new Set([r]):t.add(r),Ju(e,r,a)),!1;case 22:return n.flags|=65536,r===xa?n.flags|=16384:(t=n.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([r])},n.updateQueue=t):(n=t.retryQueue,n===null?t.retryQueue=new Set([r]):n.add(r)),Ju(e,r,a)),!1}throw Error(i(435,n.tag))}return Ju(e,r,a),ku(),!1}if(Ai)return t=Qa.current,t===null?(r!==Ni&&(t=Error(i(423),{cause:r}),Bi(pi(t,n))),e=e.current.alternate,e.flags|=65536,a&=-a,e.lanes|=a,r=pi(r,n),a=Xs(e.stateNode,r,a),Va(e,a),Kl!==4&&(Kl=2)):(!(t.flags&65536)&&(t.flags|=256),t.flags|=65536,t.lanes=a,r!==Ni&&(e=Error(i(422),{cause:r}),Bi(pi(e,n)))),!1;var o=Error(i(520),{cause:r});if(o=pi(o,n),Ql===null?Ql=[o]:Ql.push(o),Kl!==4&&(Kl=2),t===null)return!0;r=pi(r,n),n=t;do{switch(n.tag){case 3:return n.flags|=65536,e=a&-a,n.lanes|=e,e=Xs(n.stateNode,r,e),Va(n,e),!1;case 1:if(t=n.type,o=n.stateNode,!(n.flags&128)&&(typeof t.getDerivedStateFromError==`function`||o!==null&&typeof o.componentDidCatch==`function`&&(au===null||!au.has(o))))return n.flags|=65536,a&=-a,n.lanes|=a,a=Zs(a),Qs(a,e,n,r),Va(n,a),!1}n=n.return}while(n!==null);return!1}var ec=Error(i(461)),tc=!1;function nc(e,t,n,r){t.child=e===null?Pa(t,null,n,r):Na(t,e.child,n,r)}function rc(e,t,n,r,i){n=n.render;var a=t.ref;if(`ref`in r){var o={};for(var s in r)s!==`ref`&&(o[s]=r[s])}else o=r;return Xi(t),r=bo(e,t,n,o,a,i),s=wo(),e!==null&&!tc?(To(e,t,i),Dc(e,t,i)):(Ai&&s&&Ti(t),t.flags|=1,nc(e,t,r,i),t.child)}function ic(e,t,n,r,i){if(e===null){var a=n.type;return typeof a==`function`&&!ii(a)&&a.defaultProps===void 0&&n.compare===null?(t.tag=15,t.type=a,ac(e,t,a,r,i)):(e=si(n.type,null,r,t,t.mode,i),e.ref=t.ref,e.return=t,t.child=e)}if(a=e.child,!Oc(e,i)){var o=a.memoizedProps;if(n=n.compare,n=n===null?vr:n,n(o,r)&&e.ref===t.ref)return Dc(e,t,i)}return t.flags|=1,e=ai(a,r),e.ref=t.ref,e.return=t,t.child=e}function ac(e,t,n,r,i){if(e!==null){var a=e.memoizedProps;if(vr(a,r)&&e.ref===t.ref)if(tc=!1,t.pendingProps=r=a,Oc(e,i))e.flags&131072&&(tc=!0);else return t.lanes=e.lanes,Dc(e,t,i)}return pc(e,t,n,r,i)}function oc(e,t,n,r){var i=r.children,a=e===null?null:e.memoizedState;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),r.mode===`hidden`){if(t.flags&128){if(a=a===null?n:a.baseLanes|n,e!==null){for(r=t.child=e.child,i=0;r!==null;)i=i|r.lanes|r.childLanes,r=r.sibling;r=i&~a}else r=0,t.child=null;return cc(e,t,a,n,r)}if(n&536870912)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&ga(t,a===null?null:a.cachePool),a===null?Xa():Ya(t,a),no(t);else return r=t.lanes=536870912,cc(e,t,a===null?n:a.baseLanes|n,n,r)}else a===null?(e!==null&&ga(t,null),Xa(),ro(t)):(ga(t,a.cachePool),Ya(t,a),ro(t),t.memoizedState=null);return nc(e,t,i,n),t.child}function sc(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function cc(e,t,n,r,i){var a=ha();return a=a===null?null:{parent:ra._currentValue,pool:a},t.memoizedState={baseLanes:n,cachePool:a},e!==null&&ga(t,null),Xa(),no(t),e!==null&&Ji(e,t,r,!0),t.childLanes=i,null}function lc(e,t){return t=Sc({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function uc(e,t,n){return Na(t,e.child,null,n),e=lc(t,t.pendingProps),e.flags|=2,io(t),t.memoizedState=null,e}function dc(e,t,n){var r=t.pendingProps,a=(t.flags&128)!=0;if(t.flags&=-129,e===null){if(Ai){if(r.mode===`hidden`)return e=lc(t,r),t.lanes=536870912,sc(null,e);if(to(t),(e=ki)?(e=sf(e,Mi),e=e!==null&&e.data===`&`?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:bi===null?null:{id:xi,overflow:Si},retryLane:536870912,hydrationErrors:null},n=ui(e),n.return=t,t.child=n,Oi=t,ki=null)):e=null,e===null)throw Pi(t);return t.lanes=536870912,null}return lc(t,r)}var o=e.memoizedState;if(o!==null){var s=o.dehydrated;if(to(t),a)if(t.flags&256)t.flags&=-257,t=uc(e,t,n);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(i(558));else if(tc||Ji(e,t,n,!1),a=(n&e.childLanes)!==0,tc||a){if(r=zl,r!==null&&(s=Ye(r,n),s!==0&&s!==o.retryLane))throw o.retryLane=s,Qr(e,s),_u(r,e,s),ec;ku(),t=uc(e,t,n)}else e=o.treeContext,ki=uf(s.nextSibling),Oi=t,Ai=!0,ji=null,Mi=!1,e!==null&&Di(t,e),t=lc(t,r),t.flags|=4096;return t}return e=ai(e.child,{mode:r.mode,children:r.children}),e.ref=t.ref,t.child=e,e.return=t,e}function fc(e,t){var n=t.ref;if(n===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof n!=`function`&&typeof n!=`object`)throw Error(i(284));(e===null||e.ref!==n)&&(t.flags|=4194816)}}function pc(e,t,n,r,i){return Xi(t),n=bo(e,t,n,r,void 0,i),r=wo(),e!==null&&!tc?(To(e,t,i),Dc(e,t,i)):(Ai&&r&&Ti(t),t.flags|=1,nc(e,t,n,i),t.child)}function mc(e,t,n,r,i,a){return Xi(t),t.updateQueue=null,n=So(t,r,n,i),xo(e),r=wo(),e!==null&&!tc?(To(e,t,a),Dc(e,t,a)):(Ai&&r&&Ti(t),t.flags|=1,nc(e,t,n,a),t.child)}function hc(e,t,n,r,i){if(Xi(t),t.stateNode===null){var a=ti,o=n.contextType;typeof o==`object`&&o&&(a=Zi(o)),a=new n(r,a),t.memoizedState=a.state!==null&&a.state!==void 0?a.state:null,a.updater=Vs,t.stateNode=a,a._reactInternals=t,a=t.stateNode,a.props=r,a.state=t.memoizedState,a.refs={},Ia(t),o=n.contextType,a.context=typeof o==`object`&&o?Zi(o):ti,a.state=t.memoizedState,o=n.getDerivedStateFromProps,typeof o==`function`&&(Bs(t,n,o,r),a.state=t.memoizedState),typeof n.getDerivedStateFromProps==`function`||typeof a.getSnapshotBeforeUpdate==`function`||typeof a.UNSAFE_componentWillMount!=`function`&&typeof a.componentWillMount!=`function`||(o=a.state,typeof a.componentWillMount==`function`&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount==`function`&&a.UNSAFE_componentWillMount(),o!==a.state&&Vs.enqueueReplaceState(a,a.state,null),Wa(t,r,a,i),Ua(),a.state=t.memoizedState),typeof a.componentDidMount==`function`&&(t.flags|=4194308),r=!0}else if(e===null){a=t.stateNode;var s=t.memoizedProps,c=Ws(n,s);a.props=c;var l=a.context,u=n.contextType;o=ti,typeof u==`object`&&u&&(o=Zi(u));var d=n.getDerivedStateFromProps;u=typeof d==`function`||typeof a.getSnapshotBeforeUpdate==`function`,s=t.pendingProps!==s,u||typeof a.UNSAFE_componentWillReceiveProps!=`function`&&typeof a.componentWillReceiveProps!=`function`||(s||l!==o)&&Us(t,a,r,o),Fa=!1;var f=t.memoizedState;a.state=f,Wa(t,r,a,i),Ua(),l=t.memoizedState,s||f!==l||Fa?(typeof d==`function`&&(Bs(t,n,d,r),l=t.memoizedState),(c=Fa||Hs(t,n,c,r,f,l,o))?(u||typeof a.UNSAFE_componentWillMount!=`function`&&typeof a.componentWillMount!=`function`||(typeof a.componentWillMount==`function`&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount==`function`&&a.UNSAFE_componentWillMount()),typeof a.componentDidMount==`function`&&(t.flags|=4194308)):(typeof a.componentDidMount==`function`&&(t.flags|=4194308),t.memoizedProps=r,t.memoizedState=l),a.props=r,a.state=l,a.context=o,r=c):(typeof a.componentDidMount==`function`&&(t.flags|=4194308),r=!1)}else{a=t.stateNode,La(e,t),o=t.memoizedProps,u=Ws(n,o),a.props=u,d=t.pendingProps,f=a.context,l=n.contextType,c=ti,typeof l==`object`&&l&&(c=Zi(l)),s=n.getDerivedStateFromProps,(l=typeof s==`function`||typeof a.getSnapshotBeforeUpdate==`function`)||typeof a.UNSAFE_componentWillReceiveProps!=`function`&&typeof a.componentWillReceiveProps!=`function`||(o!==d||f!==c)&&Us(t,a,r,c),Fa=!1,f=t.memoizedState,a.state=f,Wa(t,r,a,i),Ua();var p=t.memoizedState;o!==d||f!==p||Fa||e!==null&&e.dependencies!==null&&Yi(e.dependencies)?(typeof s==`function`&&(Bs(t,n,s,r),p=t.memoizedState),(u=Fa||Hs(t,n,u,r,f,p,c)||e!==null&&e.dependencies!==null&&Yi(e.dependencies))?(l||typeof a.UNSAFE_componentWillUpdate!=`function`&&typeof a.componentWillUpdate!=`function`||(typeof a.componentWillUpdate==`function`&&a.componentWillUpdate(r,p,c),typeof a.UNSAFE_componentWillUpdate==`function`&&a.UNSAFE_componentWillUpdate(r,p,c)),typeof a.componentDidUpdate==`function`&&(t.flags|=4),typeof a.getSnapshotBeforeUpdate==`function`&&(t.flags|=1024)):(typeof a.componentDidUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=1024),t.memoizedProps=r,t.memoizedState=p),a.props=r,a.state=p,a.context=c,r=u):(typeof a.componentDidUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=1024),r=!1)}return a=r,fc(e,t),r=(t.flags&128)!=0,a||r?(a=t.stateNode,n=r&&typeof n.getDerivedStateFromError!=`function`?null:a.render(),t.flags|=1,e!==null&&r?(t.child=Na(t,e.child,null,i),t.child=Na(t,null,n,i)):nc(e,t,n,i),t.memoizedState=a.state,e=t.child):e=Dc(e,t,i),e}function gc(e,t,n,r){return Ri(),t.flags|=256,nc(e,t,n,r),t.child}var _c={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function vc(e){return{baseLanes:e,cachePool:_a()}}function yc(e,t,n){return e=e===null?0:e.childLanes&~n,t&&(e|=Xl),e}function bc(e,t,n){var r=t.pendingProps,a=!1,o=(t.flags&128)!=0,s;if((s=o)||(s=e!==null&&e.memoizedState===null?!1:(ao.current&2)!=0),s&&(a=!0,t.flags&=-129),s=(t.flags&32)!=0,t.flags&=-33,e===null){if(Ai){if(a?eo(t):ro(t),(e=ki)?(e=sf(e,Mi),e=e!==null&&e.data!==`&`?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:bi===null?null:{id:xi,overflow:Si},retryLane:536870912,hydrationErrors:null},n=ui(e),n.return=t,t.child=n,Oi=t,ki=null)):e=null,e===null)throw Pi(t);return Z(e)?t.lanes=32:t.lanes=536870912,null}var c=r.children;return r=r.fallback,a?(ro(t),a=t.mode,c=Sc({mode:`hidden`,children:c},a),r=ci(r,a,n,null),c.return=t,r.return=t,c.sibling=r,t.child=c,r=t.child,r.memoizedState=vc(n),r.childLanes=yc(e,s,n),t.memoizedState=_c,sc(null,r)):(eo(t),xc(t,c))}var l=e.memoizedState;if(l!==null&&(c=l.dehydrated,c!==null)){if(o)t.flags&256?(eo(t),t.flags&=-257,t=Cc(e,t,n)):t.memoizedState===null?(ro(t),c=r.fallback,a=t.mode,r=Sc({mode:`visible`,children:r.children},a),c=ci(c,a,n,null),c.flags|=2,r.return=t,c.return=t,r.sibling=c,t.child=r,Na(t,e.child,null,n),r=t.child,r.memoizedState=vc(n),r.childLanes=yc(e,s,n),t.memoizedState=_c,t=sc(null,r)):(ro(t),t.child=e.child,t.flags|=128,t=null);else if(eo(t),Z(c)){if(s=c.nextSibling&&c.nextSibling.dataset,s)var u=s.dgst;s=u,r=Error(i(419)),r.stack=``,r.digest=s,Bi({value:r,source:null,stack:null}),t=Cc(e,t,n)}else if(tc||Ji(e,t,n,!1),s=(n&e.childLanes)!==0,tc||s){if(s=zl,s!==null&&(r=Ye(s,n),r!==0&&r!==l.retryLane))throw l.retryLane=r,Qr(e,r),_u(s,e,r),ec;cf(c)||ku(),t=Cc(e,t,n)}else cf(c)?(t.flags|=192,t.child=e.child,t=null):(e=l.treeContext,ki=uf(c.nextSibling),Oi=t,Ai=!0,ji=null,Mi=!1,e!==null&&Di(t,e),t=xc(t,r.children),t.flags|=4096);return t}return a?(ro(t),c=r.fallback,a=t.mode,l=e.child,u=l.sibling,r=ai(l,{mode:`hidden`,children:r.children}),r.subtreeFlags=l.subtreeFlags&65011712,u===null?(c=ci(c,a,n,null),c.flags|=2):c=ai(u,c),c.return=t,r.return=t,r.sibling=c,t.child=r,sc(null,r),r=t.child,c=e.child.memoizedState,c===null?c=vc(n):(a=c.cachePool,a===null?a=_a():(l=ra._currentValue,a=a.parent===l?a:{parent:l,pool:l}),c={baseLanes:c.baseLanes|n,cachePool:a}),r.memoizedState=c,r.childLanes=yc(e,s,n),t.memoizedState=_c,sc(e.child,r)):(eo(t),n=e.child,e=n.sibling,n=ai(n,{mode:`visible`,children:r.children}),n.return=t,n.sibling=null,e!==null&&(s=t.deletions,s===null?(t.deletions=[e],t.flags|=16):s.push(e)),t.child=n,t.memoizedState=null,n)}function xc(e,t){return t=Sc({mode:`visible`,children:t},e.mode),t.return=e,e.child=t}function Sc(e,t){return e=ri(22,e,null,t),e.lanes=0,e}function Cc(e,t,n){return Na(t,e.child,null,n),e=xc(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function wc(e,t,n){e.lanes|=t;var r=e.alternate;r!==null&&(r.lanes|=t),Ki(e.return,t,n)}function Tc(e,t,n,r,i,a){var o=e.memoizedState;o===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:r,tail:n,tailMode:i,treeForkCount:a}:(o.isBackwards=t,o.rendering=null,o.renderingStartTime=0,o.last=r,o.tail=n,o.tailMode=i,o.treeForkCount=a)}function Ec(e,t,n){var r=t.pendingProps,i=r.revealOrder,a=r.tail;r=r.children;var o=ao.current,s=(o&2)!=0;if(s?(o=o&1|2,t.flags|=128):o&=1,L(ao,o),nc(e,t,r,n),r=Ai?_i:0,!s&&e!==null&&e.flags&128)a:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&wc(e,n,t);else if(e.tag===19)wc(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break a;for(;e.sibling===null;){if(e.return===null||e.return===t)break a;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(i){case`forwards`:for(n=t.child,i=null;n!==null;)e=n.alternate,e!==null&&oo(e)===null&&(i=n),n=n.sibling;n=i,n===null?(i=t.child,t.child=null):(i=n.sibling,n.sibling=null),Tc(t,!1,i,n,a,r);break;case`backwards`:case`unstable_legacy-backwards`:for(n=null,i=t.child,t.child=null;i!==null;){if(e=i.alternate,e!==null&&oo(e)===null){t.child=i;break}e=i.sibling,i.sibling=n,n=i,i=e}Tc(t,!0,n,null,a,r);break;case`together`:Tc(t,!1,null,null,void 0,r);break;default:t.memoizedState=null}return t.child}function Dc(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),ql|=t.lanes,(n&t.childLanes)===0)if(e!==null){if(Ji(e,t,n,!1),(n&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(i(153));if(t.child!==null){for(e=t.child,n=ai(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=ai(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function Oc(e,t){return(e.lanes&t)===0?(e=e.dependencies,!!(e!==null&&Yi(e))):!0}function kc(e,t,n){switch(t.tag){case 3:ue(t,t.stateNode.containerInfo),Wi(t,ra,e.memoizedState.cache),Ri();break;case 27:case 5:z(t);break;case 4:ue(t,t.stateNode.containerInfo);break;case 10:Wi(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,to(t),null;break;case 13:var r=t.memoizedState;if(r!==null)return r.dehydrated===null?(n&t.child.childLanes)===0?(eo(t),e=Dc(e,t,n),e===null?null:e.sibling):bc(e,t,n):(eo(t),t.flags|=128,null);eo(t);break;case 19:var i=(e.flags&128)!=0;if(r=(n&t.childLanes)!==0,r||=(Ji(e,t,n,!1),(n&t.childLanes)!==0),i){if(r)return Ec(e,t,n);t.flags|=128}if(i=t.memoizedState,i!==null&&(i.rendering=null,i.tail=null,i.lastEffect=null),L(ao,ao.current),r)break;return null;case 22:return t.lanes=0,oc(e,t,n,t.pendingProps);case 24:Wi(t,ra,e.memoizedState.cache)}return Dc(e,t,n)}function Ac(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps)tc=!0;else{if(!Oc(e,n)&&!(t.flags&128))return tc=!1,kc(e,t,n);tc=!!(e.flags&131072)}else tc=!1,Ai&&t.flags&1048576&&wi(t,_i,t.index);switch(t.lanes=0,t.tag){case 16:a:{var r=t.pendingProps;if(e=wa(t.elementType),t.type=e,typeof e==`function`)ii(e)?(r=Ws(e,r),t.tag=1,t=hc(null,t,e,r,n)):(t.tag=0,t=pc(null,t,e,r,n));else{if(e!=null){var a=e.$$typeof;if(a===w){t.tag=11,t=rc(null,t,e,r,n);break a}else if(a===D){t.tag=14,t=ic(null,t,e,r,n);break a}}throw t=te(e)||e,Error(i(306,t,``))}}return t;case 0:return pc(e,t,t.type,t.pendingProps,n);case 1:return r=t.type,a=Ws(r,t.pendingProps),hc(e,t,r,a,n);case 3:a:{if(ue(t,t.stateNode.containerInfo),e===null)throw Error(i(387));r=t.pendingProps;var o=t.memoizedState;a=o.element,La(e,t),Wa(t,r,null,n);var s=t.memoizedState;if(r=s.cache,Wi(t,ra,r),r!==o.cache&&qi(t,[ra],n,!0),Ua(),r=s.element,o.isDehydrated)if(o={element:r,isDehydrated:!1,cache:s.cache},t.updateQueue.baseState=o,t.memoizedState=o,t.flags&256){t=gc(e,t,r,n);break a}else if(r!==a){a=pi(Error(i(424)),t),Bi(a),t=gc(e,t,r,n);break a}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName===`HTML`?e.ownerDocument.body:e}for(ki=uf(e.firstChild),Oi=t,Ai=!0,ji=null,Mi=!0,n=Pa(t,null,r,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling}else{if(Ri(),r===a){t=Dc(e,t,n);break a}nc(e,t,r,n)}t=t.child}return t;case 26:return fc(e,t),e===null?(n=jf(t.type,null,t.pendingProps,null))?t.memoizedState=n:Ai||(n=t.type,e=t.pendingProps,r=Wd(ce.current).createElement(n),r[tt]=t,r[nt]=e,Rd(r,n,e),mt(r),t.stateNode=r):t.memoizedState=jf(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return z(t),e===null&&Ai&&(r=t.stateNode=mf(t.type,t.pendingProps,ce.current),Oi=t,Mi=!0,a=ki,tf(t.type)?(df=a,ki=uf(r.firstChild)):ki=a),nc(e,t,t.pendingProps.children,n),fc(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&Ai&&((a=r=ki)&&(r=of(r,t.type,t.pendingProps,Mi),r===null?a=!1:(t.stateNode=r,Oi=t,ki=uf(r.firstChild),Mi=!1,a=!0)),a||Pi(t)),z(t),a=t.type,o=t.pendingProps,s=e===null?null:e.memoizedProps,r=o.children,qd(a,o)?r=null:s!==null&&qd(a,s)&&(t.flags|=32),t.memoizedState!==null&&(a=bo(e,t,Co,null,null,n),ep._currentValue=a),fc(e,t),nc(e,t,r,n),t.child;case 6:return e===null&&Ai&&((e=n=ki)&&(n=X(n,t.pendingProps,Mi),n===null?e=!1:(t.stateNode=n,Oi=t,ki=null,e=!0)),e||Pi(t)),null;case 13:return bc(e,t,n);case 4:return ue(t,t.stateNode.containerInfo),r=t.pendingProps,e===null?t.child=Na(t,null,r,n):nc(e,t,r,n),t.child;case 11:return rc(e,t,t.type,t.pendingProps,n);case 7:return nc(e,t,t.pendingProps,n),t.child;case 8:return nc(e,t,t.pendingProps.children,n),t.child;case 12:return nc(e,t,t.pendingProps.children,n),t.child;case 10:return r=t.pendingProps,Wi(t,t.type,r.value),nc(e,t,r.children,n),t.child;case 9:return a=t.type._context,r=t.pendingProps.children,Xi(t),a=Zi(a),r=r(a),t.flags|=1,nc(e,t,r,n),t.child;case 14:return ic(e,t,t.type,t.pendingProps,n);case 15:return ac(e,t,t.type,t.pendingProps,n);case 19:return Ec(e,t,n);case 31:return dc(e,t,n);case 22:return oc(e,t,n,t.pendingProps);case 24:return Xi(t),r=Zi(ra),e===null?(a=ha(),a===null&&(a=zl,o=ia(),a.pooledCache=o,o.refCount++,o!==null&&(a.pooledCacheLanes|=n),a=o),t.memoizedState={parent:r,cache:a},Ia(t),Wi(t,ra,a)):((e.lanes&n)!==0&&(La(e,t),Wa(t,null,null,n),Ua()),a=e.memoizedState,o=t.memoizedState,a.parent===r?(r=o.cache,Wi(t,ra,r),r!==a.cache&&qi(t,[ra],n,!0)):(a={parent:r,cache:r},t.memoizedState=a,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=a),Wi(t,ra,r))),nc(e,t,t.pendingProps.children,n),t.child;case 29:throw t.pendingProps}throw Error(i(156,t.tag))}function jc(e){e.flags|=4}function Mc(e,t,n,r,i){if((t=(e.mode&32)!=0)&&(t=!1),t){if(e.flags|=16777216,(i&335544128)===i)if(e.stateNode.complete)e.flags|=8192;else if(Eu())e.flags|=8192;else throw Ta=xa,ya}else e.flags&=-16777217}function Nc(e,t){if(t.type!==`stylesheet`||t.state.loading&4)e.flags&=-16777217;else if(e.flags|=16777216,!Kf(t))if(Eu())e.flags|=8192;else throw Ta=xa,ya}function Pc(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag===22?536870912:Ue(),e.lanes|=t,Zl|=t)}function Fc(e,t){if(!Ai)switch(e.tailMode){case`hidden`:t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case`collapsed`:n=e.tail;for(var r=null;n!==null;)n.alternate!==null&&(r=n),n=n.sibling;r===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:r.sibling=null}}function Ic(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,r=0;if(t)for(var i=e.child;i!==null;)n|=i.lanes|i.childLanes,r|=i.subtreeFlags&65011712,r|=i.flags&65011712,i.return=e,i=i.sibling;else for(i=e.child;i!==null;)n|=i.lanes|i.childLanes,r|=i.subtreeFlags,r|=i.flags,i.return=e,i=i.sibling;return e.subtreeFlags|=r,e.childLanes=n,t}function Lc(e,t,n){var r=t.pendingProps;switch(Ei(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Ic(t),null;case 1:return Ic(t),null;case 3:return n=t.stateNode,r=null,e!==null&&(r=e.memoizedState.cache),t.memoizedState.cache!==r&&(t.flags|=2048),Gi(ra),R(),n.pendingContext&&(n.context=n.pendingContext,n.pendingContext=null),(e===null||e.child===null)&&(Li(t)?jc(t):e===null||e.memoizedState.isDehydrated&&!(t.flags&256)||(t.flags|=1024,zi())),Ic(t),null;case 26:var a=t.type,o=t.memoizedState;return e===null?(jc(t),o===null?(Ic(t),Mc(t,a,null,r,n)):(Ic(t),Nc(t,o))):o?o===e.memoizedState?(Ic(t),t.flags&=-16777217):(jc(t),Ic(t),Nc(t,o)):(e=e.memoizedProps,e!==r&&jc(t),Ic(t),Mc(t,a,e,r,n)),null;case 27:if(de(t),n=ce.current,a=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==r&&jc(t);else{if(!r){if(t.stateNode===null)throw Error(i(166));return Ic(t),null}e=oe.current,Li(t)?Fi(t,e):(e=mf(a,r,n),t.stateNode=e,jc(t))}return Ic(t),null;case 5:if(de(t),a=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==r&&jc(t);else{if(!r){if(t.stateNode===null)throw Error(i(166));return Ic(t),null}if(o=oe.current,Li(t))Fi(t,o);else{var s=Wd(ce.current);switch(o){case 1:o=s.createElementNS(`http://www.w3.org/2000/svg`,a);break;case 2:o=s.createElementNS(`http://www.w3.org/1998/Math/MathML`,a);break;default:switch(a){case`svg`:o=s.createElementNS(`http://www.w3.org/2000/svg`,a);break;case`math`:o=s.createElementNS(`http://www.w3.org/1998/Math/MathML`,a);break;case`script`:o=s.createElement(`div`),o.innerHTML=`<script><\/script>`,o=o.removeChild(o.firstChild);break;case`select`:o=typeof r.is==`string`?s.createElement(`select`,{is:r.is}):s.createElement(`select`),r.multiple?o.multiple=!0:r.size&&(o.size=r.size);break;default:o=typeof r.is==`string`?s.createElement(a,{is:r.is}):s.createElement(a)}}o[tt]=t,o[nt]=r;a:for(s=t.child;s!==null;){if(s.tag===5||s.tag===6)o.appendChild(s.stateNode);else if(s.tag!==4&&s.tag!==27&&s.child!==null){s.child.return=s,s=s.child;continue}if(s===t)break a;for(;s.sibling===null;){if(s.return===null||s.return===t)break a;s=s.return}s.sibling.return=s.return,s=s.sibling}t.stateNode=o;a:switch(Rd(o,a,r),a){case`button`:case`input`:case`select`:case`textarea`:r=!!r.autoFocus;break a;case`img`:r=!0;break a;default:r=!1}r&&jc(t)}}return Ic(t),Mc(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,n),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==r&&jc(t);else{if(typeof r!=`string`&&t.stateNode===null)throw Error(i(166));if(e=ce.current,Li(t)){if(e=t.stateNode,n=t.memoizedProps,r=null,a=Oi,a!==null)switch(a.tag){case 27:case 5:r=a.memoizedProps}e[tt]=t,e=!!(e.nodeValue===n||r!==null&&!0===r.suppressHydrationWarning||Fd(e.nodeValue,n)),e||Pi(t,!0)}else e=Wd(e).createTextNode(r),e[tt]=t,t.stateNode=e}return Ic(t),null;case 31:if(n=t.memoizedState,e===null||e.memoizedState!==null){if(r=Li(t),n!==null){if(e===null){if(!r)throw Error(i(318));if(e=t.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(557));e[tt]=t}else Ri(),!(t.flags&128)&&(t.memoizedState=null),t.flags|=4;Ic(t),e=!1}else n=zi(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=n),e=!0;if(!e)return t.flags&256?(io(t),t):(io(t),null);if(t.flags&128)throw Error(i(558))}return Ic(t),null;case 13:if(r=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(a=Li(t),r!==null&&r.dehydrated!==null){if(e===null){if(!a)throw Error(i(318));if(a=t.memoizedState,a=a===null?null:a.dehydrated,!a)throw Error(i(317));a[tt]=t}else Ri(),!(t.flags&128)&&(t.memoizedState=null),t.flags|=4;Ic(t),a=!1}else a=zi(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=a),a=!0;if(!a)return t.flags&256?(io(t),t):(io(t),null)}return io(t),t.flags&128?(t.lanes=n,t):(n=r!==null,e=e!==null&&e.memoizedState!==null,n&&(r=t.child,a=null,r.alternate!==null&&r.alternate.memoizedState!==null&&r.alternate.memoizedState.cachePool!==null&&(a=r.alternate.memoizedState.cachePool.pool),o=null,r.memoizedState!==null&&r.memoizedState.cachePool!==null&&(o=r.memoizedState.cachePool.pool),o!==a&&(r.flags|=2048)),n!==e&&n&&(t.child.flags|=8192),Pc(t,t.updateQueue),Ic(t),null);case 4:return R(),e===null&&Td(t.stateNode.containerInfo),Ic(t),null;case 10:return Gi(t.type),Ic(t),null;case 19:if(ae(ao),r=t.memoizedState,r===null)return Ic(t),null;if(a=(t.flags&128)!=0,o=r.rendering,o===null)if(a)Fc(r,!1);else{if(Kl!==0||e!==null&&e.flags&128)for(e=t.child;e!==null;){if(o=oo(e),o!==null){for(t.flags|=128,Fc(r,!1),e=o.updateQueue,t.updateQueue=e,Pc(t,e),t.subtreeFlags=0,e=n,n=t.child;n!==null;)oi(n,e),n=n.sibling;return L(ao,ao.current&1|2),Ai&&Ci(t,r.treeForkCount),t.child}e=e.sibling}r.tail!==null&&be()>ru&&(t.flags|=128,a=!0,Fc(r,!1),t.lanes=4194304)}else{if(!a)if(e=oo(o),e!==null){if(t.flags|=128,a=!0,e=e.updateQueue,t.updateQueue=e,Pc(t,e),Fc(r,!0),r.tail===null&&r.tailMode===`hidden`&&!o.alternate&&!Ai)return Ic(t),null}else 2*be()-r.renderingStartTime>ru&&n!==536870912&&(t.flags|=128,a=!0,Fc(r,!1),t.lanes=4194304);r.isBackwards?(o.sibling=t.child,t.child=o):(e=r.last,e===null?t.child=o:e.sibling=o,r.last=o)}return r.tail===null?(Ic(t),null):(e=r.tail,r.rendering=e,r.tail=e.sibling,r.renderingStartTime=be(),e.sibling=null,n=ao.current,L(ao,a?n&1|2:n&1),Ai&&Ci(t,r.treeForkCount),e);case 22:case 23:return io(t),Za(),r=t.memoizedState!==null,e===null?r&&(t.flags|=8192):e.memoizedState!==null!==r&&(t.flags|=8192),r?n&536870912&&!(t.flags&128)&&(Ic(t),t.subtreeFlags&6&&(t.flags|=8192)):Ic(t),n=t.updateQueue,n!==null&&Pc(t,n.retryQueue),n=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),r=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(r=t.memoizedState.cachePool.pool),r!==n&&(t.flags|=2048),e!==null&&ae(ma),null;case 24:return n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),Gi(ra),Ic(t),null;case 25:return null;case 30:return null}throw Error(i(156,t.tag))}function Rc(e,t){switch(Ei(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return Gi(ra),R(),e=t.flags,e&65536&&!(e&128)?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return de(t),null;case 31:if(t.memoizedState!==null){if(io(t),t.alternate===null)throw Error(i(340));Ri()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(io(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(i(340));Ri()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return ae(ao),null;case 4:return R(),null;case 10:return Gi(t.type),null;case 22:case 23:return io(t),Za(),e!==null&&ae(ma),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return Gi(ra),null;case 25:return null;default:return null}}function zc(e,t){switch(Ei(t),t.tag){case 3:Gi(ra),R();break;case 26:case 27:case 5:de(t);break;case 4:R();break;case 31:t.memoizedState!==null&&io(t);break;case 13:io(t);break;case 19:ae(ao);break;case 10:Gi(t.type);break;case 22:case 23:io(t),Za(),e!==null&&ae(ma);break;case 24:Gi(ra)}}function K(e,t){try{var n=t.updateQueue,r=n===null?null:n.lastEffect;if(r!==null){var i=r.next;n=i;do{if((n.tag&e)===e){r=void 0;var a=n.create,o=n.inst;r=a(),o.destroy=r}n=n.next}while(n!==i)}}catch(e){qu(t,t.return,e)}}function Bc(e,t,n){try{var r=t.updateQueue,i=r===null?null:r.lastEffect;if(i!==null){var a=i.next;r=a;do{if((r.tag&e)===e){var o=r.inst,s=o.destroy;if(s!==void 0){o.destroy=void 0,i=t;var c=n,l=s;try{l()}catch(e){qu(i,c,e)}}}r=r.next}while(r!==a)}}catch(e){qu(t,t.return,e)}}function Vc(e){var t=e.updateQueue;if(t!==null){var n=e.stateNode;try{Ka(t,n)}catch(t){qu(e,e.return,t)}}}function Hc(e,t,n){n.props=Ws(e.type,e.memoizedProps),n.state=e.memoizedState;try{n.componentWillUnmount()}catch(n){qu(e,t,n)}}function Uc(e,t){try{var n=e.ref;if(n!==null){switch(e.tag){case 26:case 27:case 5:var r=e.stateNode;break;case 30:r=e.stateNode;break;default:r=e.stateNode}typeof n==`function`?e.refCleanup=n(r):n.current=r}}catch(n){qu(e,t,n)}}function Wc(e,t){var n=e.ref,r=e.refCleanup;if(n!==null)if(typeof r==`function`)try{r()}catch(n){qu(e,t,n)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof n==`function`)try{n(null)}catch(n){qu(e,t,n)}else n.current=null}function Gc(e){var t=e.type,n=e.memoizedProps,r=e.stateNode;try{a:switch(t){case`button`:case`input`:case`select`:case`textarea`:n.autoFocus&&r.focus();break a;case`img`:n.src?r.src=n.src:n.srcSet&&(r.srcset=n.srcSet)}}catch(t){qu(e,e.return,t)}}function Kc(e,t,n){try{var r=e.stateNode;zd(r,e.type,n,t),r[nt]=t}catch(t){qu(e,e.return,t)}}function qc(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&tf(e.type)||e.tag===4}function Jc(e){a:for(;;){for(;e.sibling===null;){if(e.return===null||qc(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&tf(e.type)||e.flags&2||e.child===null||e.tag===4)continue a;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Yc(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?(n.nodeType===9?n.body:n.nodeName===`HTML`?n.ownerDocument.body:n).insertBefore(e,t):(t=n.nodeType===9?n.body:n.nodeName===`HTML`?n.ownerDocument.body:n,t.appendChild(e),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=Jt));else if(r!==4&&(r===27&&tf(e.type)&&(n=e.stateNode,t=null),e=e.child,e!==null))for(Yc(e,t,n),e=e.sibling;e!==null;)Yc(e,t,n),e=e.sibling}function Xc(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(r!==4&&(r===27&&tf(e.type)&&(n=e.stateNode),e=e.child,e!==null))for(Xc(e,t,n),e=e.sibling;e!==null;)Xc(e,t,n),e=e.sibling}function Zc(e){var t=e.stateNode,n=e.memoizedProps;try{for(var r=e.type,i=t.attributes;i.length;)t.removeAttributeNode(i[0]);Rd(t,r,n),t[tt]=e,t[nt]=n}catch(t){qu(e,e.return,t)}}var Qc=!1,$c=!1,el=!1,tl=typeof WeakSet==`function`?WeakSet:Set,nl=null;function rl(e,t){if(e=e.containerInfo,Hd=lp,e=Sr(e),Cr(e)){if(`selectionStart`in e)var n={start:e.selectionStart,end:e.selectionEnd};else a:{n=(n=e.ownerDocument)&&n.defaultView||window;var r=n.getSelection&&n.getSelection();if(r&&r.rangeCount!==0){n=r.anchorNode;var a=r.anchorOffset,o=r.focusNode;r=r.focusOffset;try{n.nodeType,o.nodeType}catch{n=null;break a}var s=0,c=-1,l=-1,u=0,d=0,f=e,p=null;b:for(;;){for(var m;f!==n||a!==0&&f.nodeType!==3||(c=s+a),f!==o||r!==0&&f.nodeType!==3||(l=s+r),f.nodeType===3&&(s+=f.nodeValue.length),(m=f.firstChild)!==null;)p=f,f=m;for(;;){if(f===e)break b;if(p===n&&++u===a&&(c=s),p===o&&++d===r&&(l=s),(m=f.nextSibling)!==null)break;f=p,p=f.parentNode}f=m}n=c===-1||l===-1?null:{start:c,end:l}}else n=null}n||={start:0,end:0}}else n=null;for(Ud={focusedElem:e,selectionRange:n},lp=!1,nl=t;nl!==null;)if(t=nl,e=t.child,t.subtreeFlags&1028&&e!==null)e.return=t,nl=e;else for(;nl!==null;){switch(t=nl,o=t.alternate,e=t.flags,t.tag){case 0:if(e&4&&(e=t.updateQueue,e=e===null?null:e.events,e!==null))for(n=0;n<e.length;n++)a=e[n],a.ref.impl=a.nextImpl;break;case 11:case 15:break;case 1:if(e&1024&&o!==null){e=void 0,n=t,a=o.memoizedProps,o=o.memoizedState,r=n.stateNode;try{var h=Ws(n.type,a);e=r.getSnapshotBeforeUpdate(h,o),r.__reactInternalSnapshotBeforeUpdate=e}catch(e){qu(n,n.return,e)}}break;case 3:if(e&1024){if(e=t.stateNode.containerInfo,n=e.nodeType,n===9)af(e);else if(n===1)switch(e.nodeName){case`HEAD`:case`HTML`:case`BODY`:af(e);break;default:e.textContent=``}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if(e&1024)throw Error(i(163))}if(e=t.sibling,e!==null){e.return=t.return,nl=e;break}nl=t.return}}function il(e,t,n){var r=n.flags;switch(n.tag){case 0:case 11:case 15:yl(e,n),r&4&&K(5,n);break;case 1:if(yl(e,n),r&4)if(e=n.stateNode,t===null)try{e.componentDidMount()}catch(e){qu(n,n.return,e)}else{var i=Ws(n.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(i,t,e.__reactInternalSnapshotBeforeUpdate)}catch(e){qu(n,n.return,e)}}r&64&&Vc(n),r&512&&Uc(n,n.return);break;case 3:if(yl(e,n),r&64&&(e=n.updateQueue,e!==null)){if(t=null,n.child!==null)switch(n.child.tag){case 27:case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}try{Ka(e,t)}catch(e){qu(n,n.return,e)}}break;case 27:t===null&&r&4&&Zc(n);case 26:case 5:yl(e,n),t===null&&r&4&&Gc(n),r&512&&Uc(n,n.return);break;case 12:yl(e,n);break;case 31:yl(e,n),r&4&&ul(e,n);break;case 13:yl(e,n),r&4&&dl(e,n),r&64&&(e=n.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(n=Zu.bind(null,n),lf(e,n))));break;case 22:if(r=n.memoizedState!==null||Qc,!r){t=t!==null&&t.memoizedState!==null||$c,i=Qc;var a=$c;Qc=r,($c=t)&&!a?xl(e,n,(n.subtreeFlags&8772)!=0):yl(e,n),Qc=i,$c=a}break;case 30:break;default:yl(e,n)}}function al(e){var t=e.alternate;t!==null&&(e.alternate=null,al(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&lt(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var ol=null,sl=!1;function cl(e,t,n){for(n=n.child;n!==null;)ll(e,t,n),n=n.sibling}function ll(e,t,n){if(Ae&&typeof Ae.onCommitFiberUnmount==`function`)try{Ae.onCommitFiberUnmount(ke,n)}catch{}switch(n.tag){case 26:$c||Wc(n,t),cl(e,t,n),n.memoizedState?n.memoizedState.count--:n.stateNode&&(n=n.stateNode,n.parentNode.removeChild(n));break;case 27:$c||Wc(n,t);var r=ol,i=sl;tf(n.type)&&(ol=n.stateNode,sl=!1),cl(e,t,n),hf(n.stateNode),ol=r,sl=i;break;case 5:$c||Wc(n,t);case 6:if(r=ol,i=sl,ol=null,cl(e,t,n),ol=r,sl=i,ol!==null)if(sl)try{(ol.nodeType===9?ol.body:ol.nodeName===`HTML`?ol.ownerDocument.body:ol).removeChild(n.stateNode)}catch(e){qu(n,t,e)}else try{ol.removeChild(n.stateNode)}catch(e){qu(n,t,e)}break;case 18:ol!==null&&(sl?(e=ol,nf(e.nodeType===9?e.body:e.nodeName===`HTML`?e.ownerDocument.body:e,n.stateNode),Fp(e)):nf(ol,n.stateNode));break;case 4:r=ol,i=sl,ol=n.stateNode.containerInfo,sl=!0,cl(e,t,n),ol=r,sl=i;break;case 0:case 11:case 14:case 15:Bc(2,n,t),$c||Bc(4,n,t),cl(e,t,n);break;case 1:$c||(Wc(n,t),r=n.stateNode,typeof r.componentWillUnmount==`function`&&Hc(n,t,r)),cl(e,t,n);break;case 21:cl(e,t,n);break;case 22:$c=(r=$c)||n.memoizedState!==null,cl(e,t,n),$c=r;break;default:cl(e,t,n)}}function ul(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Fp(e)}catch(e){qu(t,t.return,e)}}}function dl(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Fp(e)}catch(e){qu(t,t.return,e)}}function fl(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new tl),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new tl),t;default:throw Error(i(435,e.tag))}}function pl(e,t){var n=fl(e);t.forEach(function(t){if(!n.has(t)){n.add(t);var r=Qu.bind(null,e,t);t.then(r,r)}})}function ml(e,t){var n=t.deletions;if(n!==null)for(var r=0;r<n.length;r++){var a=n[r],o=e,s=t,c=s;a:for(;c!==null;){switch(c.tag){case 27:if(tf(c.type)){ol=c.stateNode,sl=!1;break a}break;case 5:ol=c.stateNode,sl=!1;break a;case 3:case 4:ol=c.stateNode.containerInfo,sl=!0;break a}c=c.return}if(ol===null)throw Error(i(160));ll(o,s,a),ol=null,sl=!1,o=a.alternate,o!==null&&(o.return=null),a.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)gl(t,e),t=t.sibling}var hl=null;function gl(e,t){var n=e.alternate,r=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:ml(t,e),_l(e),r&4&&(Bc(3,e,e.return),K(3,e),Bc(5,e,e.return));break;case 1:ml(t,e),_l(e),r&512&&($c||n===null||Wc(n,n.return)),r&64&&Qc&&(e=e.updateQueue,e!==null&&(r=e.callbacks,r!==null&&(n=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=n===null?r:n.concat(r))));break;case 26:var a=hl;if(ml(t,e),_l(e),r&512&&($c||n===null||Wc(n,n.return)),r&4){var o=n===null?null:n.memoizedState;if(r=e.memoizedState,n===null)if(r===null)if(e.stateNode===null){a:{r=e.type,n=e.memoizedProps,a=a.ownerDocument||a;b:switch(r){case`title`:o=a.getElementsByTagName(`title`)[0],(!o||o[ct]||o[tt]||o.namespaceURI===`http://www.w3.org/2000/svg`||o.hasAttribute(`itemprop`))&&(o=a.createElement(r),a.head.insertBefore(o,a.querySelector(`head > title`))),Rd(o,r,n),o[tt]=e,mt(o),r=o;break a;case`link`:var s=Uf(`link`,`href`,a).get(r+(n.href||``));if(s){for(var c=0;c<s.length;c++)if(o=s[c],o.getAttribute(`href`)===(n.href==null||n.href===``?null:n.href)&&o.getAttribute(`rel`)===(n.rel==null?null:n.rel)&&o.getAttribute(`title`)===(n.title==null?null:n.title)&&o.getAttribute(`crossorigin`)===(n.crossOrigin==null?null:n.crossOrigin)){s.splice(c,1);break b}}o=a.createElement(r),Rd(o,r,n),a.head.appendChild(o);break;case`meta`:if(s=Uf(`meta`,`content`,a).get(r+(n.content||``))){for(c=0;c<s.length;c++)if(o=s[c],o.getAttribute(`content`)===(n.content==null?null:``+n.content)&&o.getAttribute(`name`)===(n.name==null?null:n.name)&&o.getAttribute(`property`)===(n.property==null?null:n.property)&&o.getAttribute(`http-equiv`)===(n.httpEquiv==null?null:n.httpEquiv)&&o.getAttribute(`charset`)===(n.charSet==null?null:n.charSet)){s.splice(c,1);break b}}o=a.createElement(r),Rd(o,r,n),a.head.appendChild(o);break;default:throw Error(i(468,r))}o[tt]=e,mt(o),r=o}e.stateNode=r}else Wf(a,e.type,e.stateNode);else e.stateNode=Rf(a,r,e.memoizedProps);else o===r?r===null&&e.stateNode!==null&&Kc(e,e.memoizedProps,n.memoizedProps):(o===null?n.stateNode!==null&&(n=n.stateNode,n.parentNode.removeChild(n)):o.count--,r===null?Wf(a,e.type,e.stateNode):Rf(a,r,e.memoizedProps))}break;case 27:ml(t,e),_l(e),r&512&&($c||n===null||Wc(n,n.return)),n!==null&&r&4&&Kc(e,e.memoizedProps,n.memoizedProps);break;case 5:if(ml(t,e),_l(e),r&512&&($c||n===null||Wc(n,n.return)),e.flags&32){a=e.stateNode;try{Bt(a,``)}catch(t){qu(e,e.return,t)}}r&4&&e.stateNode!=null&&(a=e.memoizedProps,Kc(e,a,n===null?a:n.memoizedProps)),r&1024&&(el=!0);break;case 6:if(ml(t,e),_l(e),r&4){if(e.stateNode===null)throw Error(i(162));r=e.memoizedProps,n=e.stateNode;try{n.nodeValue=r}catch(t){qu(e,e.return,t)}}break;case 3:if(Hf=null,a=hl,hl=vf(t.containerInfo),ml(t,e),hl=a,_l(e),r&4&&n!==null&&n.memoizedState.isDehydrated)try{Fp(t.containerInfo)}catch(t){qu(e,e.return,t)}el&&(el=!1,vl(e));break;case 4:r=hl,hl=vf(e.stateNode.containerInfo),ml(t,e),_l(e),hl=r;break;case 12:ml(t,e),_l(e);break;case 31:ml(t,e),_l(e),r&4&&(r=e.updateQueue,r!==null&&(e.updateQueue=null,pl(e,r)));break;case 13:ml(t,e),_l(e),e.child.flags&8192&&e.memoizedState!==null!=(n!==null&&n.memoizedState!==null)&&(tu=be()),r&4&&(r=e.updateQueue,r!==null&&(e.updateQueue=null,pl(e,r)));break;case 22:a=e.memoizedState!==null;var l=n!==null&&n.memoizedState!==null,u=Qc,d=$c;if(Qc=u||a,$c=d||l,ml(t,e),$c=d,Qc=u,_l(e),r&8192)a:for(t=e.stateNode,t._visibility=a?t._visibility&-2:t._visibility|1,a&&(n===null||l||Qc||$c||bl(e)),n=null,t=e;;){if(t.tag===5||t.tag===26){if(n===null){l=n=t;try{if(o=l.stateNode,a)s=o.style,typeof s.setProperty==`function`?s.setProperty(`display`,`none`,`important`):s.display=`none`;else{c=l.stateNode;var f=l.memoizedProps.style,p=f!=null&&f.hasOwnProperty(`display`)?f.display:null;c.style.display=p==null||typeof p==`boolean`?``:(``+p).trim()}}catch(e){qu(l,l.return,e)}}}else if(t.tag===6){if(n===null){l=t;try{l.stateNode.nodeValue=a?``:l.memoizedProps}catch(e){qu(l,l.return,e)}}}else if(t.tag===18){if(n===null){l=t;try{var m=l.stateNode;a?rf(m,!0):rf(l.stateNode,!1)}catch(e){qu(l,l.return,e)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break a;for(;t.sibling===null;){if(t.return===null||t.return===e)break a;n===t&&(n=null),t=t.return}n===t&&(n=null),t.sibling.return=t.return,t=t.sibling}r&4&&(r=e.updateQueue,r!==null&&(n=r.retryQueue,n!==null&&(r.retryQueue=null,pl(e,n))));break;case 19:ml(t,e),_l(e),r&4&&(r=e.updateQueue,r!==null&&(e.updateQueue=null,pl(e,r)));break;case 30:break;case 21:break;default:ml(t,e),_l(e)}}function _l(e){var t=e.flags;if(t&2){try{for(var n,r=e.return;r!==null;){if(qc(r)){n=r;break}r=r.return}if(n==null)throw Error(i(160));switch(n.tag){case 27:var a=n.stateNode;Xc(e,Jc(e),a);break;case 5:var o=n.stateNode;n.flags&32&&(Bt(o,``),n.flags&=-33),Xc(e,Jc(e),o);break;case 3:case 4:var s=n.stateNode.containerInfo;Yc(e,Jc(e),s);break;default:throw Error(i(161))}}catch(t){qu(e,e.return,t)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function vl(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;vl(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function yl(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)il(e,t.alternate,t),t=t.sibling}function bl(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:Bc(4,t,t.return),bl(t);break;case 1:Wc(t,t.return);var n=t.stateNode;typeof n.componentWillUnmount==`function`&&Hc(t,t.return,n),bl(t);break;case 27:hf(t.stateNode);case 26:case 5:Wc(t,t.return),bl(t);break;case 22:t.memoizedState===null&&bl(t);break;case 30:bl(t);break;default:bl(t)}e=e.sibling}}function xl(e,t,n){for(n&&=(t.subtreeFlags&8772)!=0,t=t.child;t!==null;){var r=t.alternate,i=e,a=t,o=a.flags;switch(a.tag){case 0:case 11:case 15:xl(i,a,n),K(4,a);break;case 1:if(xl(i,a,n),r=a,i=r.stateNode,typeof i.componentDidMount==`function`)try{i.componentDidMount()}catch(e){qu(r,r.return,e)}if(r=a,i=r.updateQueue,i!==null){var s=r.stateNode;try{var c=i.shared.hiddenCallbacks;if(c!==null)for(i.shared.hiddenCallbacks=null,i=0;i<c.length;i++)Ga(c[i],s)}catch(e){qu(r,r.return,e)}}n&&o&64&&Vc(a),Uc(a,a.return);break;case 27:Zc(a);case 26:case 5:xl(i,a,n),n&&r===null&&o&4&&Gc(a),Uc(a,a.return);break;case 12:xl(i,a,n);break;case 31:xl(i,a,n),n&&o&4&&ul(i,a);break;case 13:xl(i,a,n),n&&o&4&&dl(i,a);break;case 22:a.memoizedState===null&&xl(i,a,n),Uc(a,a.return);break;case 30:break;default:xl(i,a,n)}t=t.sibling}}function Sl(e,t){var n=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==n&&(e!=null&&e.refCount++,n!=null&&aa(n))}function Cl(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&aa(e))}function wl(e,t,n,r){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)Tl(e,t,n,r),t=t.sibling}function Tl(e,t,n,r){var i=t.flags;switch(t.tag){case 0:case 11:case 15:wl(e,t,n,r),i&2048&&K(9,t);break;case 1:wl(e,t,n,r);break;case 3:wl(e,t,n,r),i&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&aa(e)));break;case 12:if(i&2048){wl(e,t,n,r),e=t.stateNode;try{var a=t.memoizedProps,o=a.id,s=a.onPostCommit;typeof s==`function`&&s(o,t.alternate===null?`mount`:`update`,e.passiveEffectDuration,-0)}catch(e){qu(t,t.return,e)}}else wl(e,t,n,r);break;case 31:wl(e,t,n,r);break;case 13:wl(e,t,n,r);break;case 23:break;case 22:a=t.stateNode,o=t.alternate,t.memoizedState===null?a._visibility&2?wl(e,t,n,r):(a._visibility|=2,El(e,t,n,r,(t.subtreeFlags&10256)!=0||!1)):a._visibility&2?wl(e,t,n,r):Dl(e,t),i&2048&&Sl(o,t);break;case 24:wl(e,t,n,r),i&2048&&Cl(t.alternate,t);break;default:wl(e,t,n,r)}}function El(e,t,n,r,i){for(i&&=(t.subtreeFlags&10256)!=0||!1,t=t.child;t!==null;){var a=e,o=t,s=n,c=r,l=o.flags;switch(o.tag){case 0:case 11:case 15:El(a,o,s,c,i),K(8,o);break;case 23:break;case 22:var u=o.stateNode;o.memoizedState===null?(u._visibility|=2,El(a,o,s,c,i)):u._visibility&2?El(a,o,s,c,i):Dl(a,o),i&&l&2048&&Sl(o.alternate,o);break;case 24:El(a,o,s,c,i),i&&l&2048&&Cl(o.alternate,o);break;default:El(a,o,s,c,i)}t=t.sibling}}function Dl(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var n=e,r=t,i=r.flags;switch(r.tag){case 22:Dl(n,r),i&2048&&Sl(r.alternate,r);break;case 24:Dl(n,r),i&2048&&Cl(r.alternate,r);break;default:Dl(n,r)}t=t.sibling}}var Ol=8192;function kl(e,t,n){if(e.subtreeFlags&Ol)for(e=e.child;e!==null;)Al(e,t,n),e=e.sibling}function Al(e,t,n){switch(e.tag){case 26:kl(e,t,n),e.flags&Ol&&e.memoizedState!==null&&qf(n,hl,e.memoizedState,e.memoizedProps);break;case 5:kl(e,t,n);break;case 3:case 4:var r=hl;hl=vf(e.stateNode.containerInfo),kl(e,t,n),hl=r;break;case 22:e.memoizedState===null&&(r=e.alternate,r!==null&&r.memoizedState!==null?(r=Ol,Ol=16777216,kl(e,t,n),Ol=r):kl(e,t,n));break;default:kl(e,t,n)}}function jl(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function Ml(e){var t=e.deletions;if(e.flags&16){if(t!==null)for(var n=0;n<t.length;n++){var r=t[n];nl=r,Fl(r,e)}jl(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Nl(e),e=e.sibling}function Nl(e){switch(e.tag){case 0:case 11:case 15:Ml(e),e.flags&2048&&Bc(9,e,e.return);break;case 3:Ml(e);break;case 12:Ml(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,Pl(e)):Ml(e);break;default:Ml(e)}}function Pl(e){var t=e.deletions;if(e.flags&16){if(t!==null)for(var n=0;n<t.length;n++){var r=t[n];nl=r,Fl(r,e)}jl(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:Bc(8,t,t.return),Pl(t);break;case 22:n=t.stateNode,n._visibility&2&&(n._visibility&=-3,Pl(t));break;default:Pl(t)}e=e.sibling}}function Fl(e,t){for(;nl!==null;){var n=nl;switch(n.tag){case 0:case 11:case 15:Bc(8,n,t);break;case 23:case 22:if(n.memoizedState!==null&&n.memoizedState.cachePool!==null){var r=n.memoizedState.cachePool.pool;r!=null&&r.refCount++}break;case 24:aa(n.memoizedState.cache)}if(r=n.child,r!==null)r.return=n,nl=r;else a:for(n=e;nl!==null;){r=nl;var i=r.sibling,a=r.return;if(al(r),r===n){nl=null;break a}if(i!==null){i.return=a,nl=i;break a}nl=a}}}var Il={getCacheForType:function(e){var t=Zi(ra),n=t.data.get(e);return n===void 0&&(n=e(),t.data.set(e,n)),n},cacheSignal:function(){return Zi(ra).controller.signal}},Ll=typeof WeakMap==`function`?WeakMap:Map,Rl=0,zl=null,q=null,J=0,Bl=0,Vl=null,Hl=!1,Ul=!1,Wl=!1,Gl=0,Kl=0,ql=0,Jl=0,Yl=0,Xl=0,Zl=0,Ql=null,$l=null,eu=!1,tu=0,nu=0,ru=1/0,iu=null,au=null,ou=0,su=null,cu=null,lu=0,uu=0,du=null,fu=null,pu=0,mu=null;function hu(){return Rl&2&&J!==0?J&-J:P.T===null?Qe():md()}function gu(){if(Xl===0)if(!(J&536870912)||Ai){var e=Le;Le<<=1,!(Le&3932160)&&(Le=262144),Xl=e}else Xl=536870912;return e=Qa.current,e!==null&&(e.flags|=32),Xl}function _u(e,t,n){(e===zl&&(Bl===2||Bl===9)||e.cancelPendingCommit!==null)&&(wu(e,0),xu(e,J,Xl,!1)),Ge(e,n),(!(Rl&2)||e!==zl)&&(e===zl&&(!(Rl&2)&&(Jl|=n),Kl===4&&xu(e,J,Xl,!1)),od(e))}function vu(e,t,n){if(Rl&6)throw Error(i(327));var r=!n&&(t&127)==0&&(t&e.expiredLanes)===0||Ve(e,t),a=r?Mu(e,t):Au(e,t,!0),o=r;do{if(a===0){Ul&&!r&&xu(e,t,0,!1);break}else{if(n=e.current.alternate,o&&!bu(n)){a=Au(e,t,!1),o=!1;continue}if(a===2){if(o=t,e.errorRecoveryDisabledLanes&o)var s=0;else s=e.pendingLanes&-536870913,s=s===0?s&536870912?536870912:0:s;if(s!==0){t=s;a:{var c=e;a=Ql;var l=c.current.memoizedState.isDehydrated;if(l&&(wu(c,s).flags|=256),s=Au(c,s,!1),s!==2){if(Wl&&!l){c.errorRecoveryDisabledLanes|=o,Jl|=o,a=4;break a}o=$l,$l=a,o!==null&&($l===null?$l=o:$l.push.apply($l,o))}a=s}if(o=!1,a!==2)continue}}if(a===1){wu(e,0),xu(e,t,0,!0);break}a:{switch(r=e,o=a,o){case 0:case 1:throw Error(i(345));case 4:if((t&4194048)!==t)break;case 6:xu(r,t,Xl,!Hl);break a;case 2:$l=null;break;case 3:case 5:break;default:throw Error(i(329))}if((t&62914560)===t&&(a=tu+300-be(),10<a)){if(xu(r,t,Xl,!Hl),Be(r,0,!0)!==0)break a;lu=t,r.timeoutHandle=Xd(yu.bind(null,r,n,$l,iu,eu,t,Xl,Jl,Zl,Hl,o,`Throttled`,-0,0),a);break a}yu(r,n,$l,iu,eu,t,Xl,Jl,Zl,Hl,o,null,-0,0)}}break}while(1);od(e)}function yu(e,t,n,r,i,a,o,s,c,l,u,d,f,p){if(e.timeoutHandle=-1,d=t.subtreeFlags,d&8192||(d&16785408)==16785408){d={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:Jt},Al(t,a,d);var m=(a&62914560)===a?tu-be():(a&4194048)===a?nu-be():0;if(m=Yf(d,m),m!==null){lu=a,e.cancelPendingCommit=m(zu.bind(null,e,t,a,n,r,i,o,s,c,u,d,null,f,p)),xu(e,a,o,!l);return}}zu(e,t,a,n,r,i,o,s,c)}function bu(e){for(var t=e;;){var n=t.tag;if((n===0||n===11||n===15)&&t.flags&16384&&(n=t.updateQueue,n!==null&&(n=n.stores,n!==null)))for(var r=0;r<n.length;r++){var i=n[r],a=i.getSnapshot;i=i.value;try{if(!_r(a(),i))return!1}catch{return!1}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function xu(e,t,n,r){t&=~Yl,t&=~Jl,e.suspendedLanes|=t,e.pingedLanes&=~t,r&&(e.warmLanes|=t),r=e.expirationTimes;for(var i=t;0<i;){var a=31-Me(i),o=1<<a;r[a]=-1,i&=~o}n!==0&&qe(e,n,t)}function Su(){return Rl&6?!0:(sd(0,!1),!1)}function Cu(){if(q!==null){if(Bl===0)var e=q.return;else e=q,Ui=Hi=null,Eo(e),Da=null,Oa=0,e=q;for(;e!==null;)zc(e.alternate,e),e=e.return;q=null}}function wu(e,t){var n=e.timeoutHandle;n!==-1&&(e.timeoutHandle=-1,Zd(n)),n=e.cancelPendingCommit,n!==null&&(e.cancelPendingCommit=null,n()),lu=0,Cu(),zl=e,q=n=ai(e.current,null),J=t,Bl=0,Vl=null,Hl=!1,Ul=Ve(e,t),Wl=!1,Zl=Xl=Yl=Jl=ql=Kl=0,$l=Ql=null,eu=!1,t&8&&(t|=t&32);var r=e.entangledLanes;if(r!==0)for(e=e.entanglements,r&=t;0<r;){var i=31-Me(r),a=1<<i;t|=e[i],r&=~a}return Gl=t,Yr(),n}function Tu(e,t){G=null,P.H=Is,t===va||t===ba?(t=W(),Bl=3):t===ya?(t=W(),Bl=4):Bl=t===ec?8:typeof t==`object`&&t&&typeof t.then==`function`?6:1,Vl=t,q===null&&(Kl=1,Js(e,pi(t,e.current)))}function Eu(){var e=Qa.current;return e===null?!0:(J&4194048)===J?$a===null:(J&62914560)===J||J&536870912?e===$a:!1}function Du(){var e=P.H;return P.H=Is,e===null?Is:e}function Ou(){var e=P.A;return P.A=Il,e}function ku(){Kl=4,Hl||(J&4194048)!==J&&Qa.current!==null||(Ul=!0),!(ql&134217727)&&!(Jl&134217727)||zl===null||xu(zl,J,Xl,!1)}function Au(e,t,n){var r=Rl;Rl|=2;var i=Du(),a=Ou();(zl!==e||J!==t)&&(iu=null,wu(e,t)),t=!1;var o=Kl;a:do try{if(Bl!==0&&q!==null){var s=q,c=Vl;switch(Bl){case 8:Cu(),o=6;break a;case 3:case 2:case 9:case 6:Qa.current===null&&(t=!0);var l=Bl;if(Bl=0,Vl=null,Iu(e,s,c,l),n&&Ul){o=0;break a}break;default:l=Bl,Bl=0,Vl=null,Iu(e,s,c,l)}}ju(),o=Kl;break}catch(t){Tu(e,t)}while(1);return t&&e.shellSuspendCounter++,Ui=Hi=null,Rl=r,P.H=i,P.A=a,q===null&&(zl=null,J=0,Yr()),o}function ju(){for(;q!==null;)Pu(q)}function Mu(e,t){var n=Rl;Rl|=2;var r=Du(),a=Ou();zl!==e||J!==t?(iu=null,ru=be()+500,wu(e,t)):Ul=Ve(e,t);a:do try{if(Bl!==0&&q!==null){t=q;var o=Vl;b:switch(Bl){case 1:Bl=0,Vl=null,Iu(e,t,o,1);break;case 2:case 9:if(Sa(o)){Bl=0,Vl=null,Fu(t);break}t=function(){Bl!==2&&Bl!==9||zl!==e||(Bl=7),od(e)},o.then(t,t);break a;case 3:Bl=7;break a;case 4:Bl=5;break a;case 7:Sa(o)?(Bl=0,Vl=null,Fu(t)):(Bl=0,Vl=null,Iu(e,t,o,7));break;case 5:var s=null;switch(q.tag){case 26:s=q.memoizedState;case 5:case 27:var c=q;if(s?Kf(s):c.stateNode.complete){Bl=0,Vl=null;var l=c.sibling;if(l!==null)q=l;else{var u=c.return;u===null?q=null:(q=u,Lu(u))}break b}}Bl=0,Vl=null,Iu(e,t,o,5);break;case 6:Bl=0,Vl=null,Iu(e,t,o,6);break;case 8:Cu(),Kl=6;break a;default:throw Error(i(462))}}Nu();break}catch(t){Tu(e,t)}while(1);return Ui=Hi=null,P.H=r,P.A=a,Rl=n,q===null?(zl=null,J=0,Yr(),Kl):0}function Nu(){for(;q!==null&&!ve();)Pu(q)}function Pu(e){var t=Ac(e.alternate,e,Gl);e.memoizedProps=e.pendingProps,t===null?Lu(e):q=t}function Fu(e){var t=e,n=t.alternate;switch(t.tag){case 15:case 0:t=mc(n,t,t.pendingProps,t.type,void 0,J);break;case 11:t=mc(n,t,t.pendingProps,t.type.render,t.ref,J);break;case 5:Eo(t);default:zc(n,t),t=q=oi(t,Gl),t=Ac(n,t,Gl)}e.memoizedProps=e.pendingProps,t===null?Lu(e):q=t}function Iu(e,t,n,r){Ui=Hi=null,Eo(t),Da=null,Oa=0;var i=t.return;try{if($s(e,i,t,n,J)){Kl=1,Js(e,pi(n,e.current)),q=null;return}}catch(t){if(i!==null)throw q=i,t;Kl=1,Js(e,pi(n,e.current)),q=null;return}t.flags&32768?(Ai||r===1?e=!0:Ul||J&536870912?e=!1:(Hl=e=!0,(r===2||r===9||r===3||r===6)&&(r=Qa.current,r!==null&&r.tag===13&&(r.flags|=16384))),Ru(t,e)):Lu(t)}function Lu(e){var t=e;do{if(t.flags&32768){Ru(t,Hl);return}e=t.return;var n=Lc(t.alternate,t,Gl);if(n!==null){q=n;return}if(t=t.sibling,t!==null){q=t;return}q=t=e}while(t!==null);Kl===0&&(Kl=5)}function Ru(e,t){do{var n=Rc(e.alternate,e);if(n!==null){n.flags&=32767,q=n;return}if(n=e.return,n!==null&&(n.flags|=32768,n.subtreeFlags=0,n.deletions=null),!t&&(e=e.sibling,e!==null)){q=e;return}q=e=n}while(e!==null);Kl=6,q=null}function zu(e,t,n,r,a,o,s,c,l){e.cancelPendingCommit=null;do Wu();while(ou!==0);if(Rl&6)throw Error(i(327));if(t!==null){if(t===e.current)throw Error(i(177));if(o=t.lanes|t.childLanes,o|=Jr,Ke(e,n,o,s,c,l),e===zl&&(q=zl=null,J=0),cu=t,su=e,lu=n,uu=o,du=a,fu=r,t.subtreeFlags&10256||t.flags&10256?(e.callbackNode=null,e.callbackPriority=0,$u(we,function(){return Gu(),null})):(e.callbackNode=null,e.callbackPriority=0),r=(t.flags&13878)!=0,t.subtreeFlags&13878||r){r=P.T,P.T=null,a=F.p,F.p=2,s=Rl,Rl|=4;try{rl(e,t,n)}finally{Rl=s,F.p=a,P.T=r}}ou=1,Bu(),Vu(),Hu()}}function Bu(){if(ou===1){ou=0;var e=su,t=cu,n=(t.flags&13878)!=0;if(t.subtreeFlags&13878||n){n=P.T,P.T=null;var r=F.p;F.p=2;var i=Rl;Rl|=4;try{gl(t,e);var a=Ud,o=Sr(e.containerInfo),s=a.focusedElem,c=a.selectionRange;if(o!==s&&s&&s.ownerDocument&&xr(s.ownerDocument.documentElement,s)){if(c!==null&&Cr(s)){var l=c.start,u=c.end;if(u===void 0&&(u=l),`selectionStart`in s)s.selectionStart=l,s.selectionEnd=Math.min(u,s.value.length);else{var d=s.ownerDocument||document,f=d&&d.defaultView||window;if(f.getSelection){var p=f.getSelection(),m=s.textContent.length,h=Math.min(c.start,m),g=c.end===void 0?h:Math.min(c.end,m);!p.extend&&h>g&&(o=g,g=h,h=o);var _=br(s,h),v=br(s,g);if(_&&v&&(p.rangeCount!==1||p.anchorNode!==_.node||p.anchorOffset!==_.offset||p.focusNode!==v.node||p.focusOffset!==v.offset)){var y=d.createRange();y.setStart(_.node,_.offset),p.removeAllRanges(),h>g?(p.addRange(y),p.extend(v.node,v.offset)):(y.setEnd(v.node,v.offset),p.addRange(y))}}}}for(d=[],p=s;p=p.parentNode;)p.nodeType===1&&d.push({element:p,left:p.scrollLeft,top:p.scrollTop});for(typeof s.focus==`function`&&s.focus(),s=0;s<d.length;s++){var b=d[s];b.element.scrollLeft=b.left,b.element.scrollTop=b.top}}lp=!!Hd,Ud=Hd=null}finally{Rl=i,F.p=r,P.T=n}}e.current=t,ou=2}}function Vu(){if(ou===2){ou=0;var e=su,t=cu,n=(t.flags&8772)!=0;if(t.subtreeFlags&8772||n){n=P.T,P.T=null;var r=F.p;F.p=2;var i=Rl;Rl|=4;try{il(e,t.alternate,t)}finally{Rl=i,F.p=r,P.T=n}}ou=3}}function Hu(){if(ou===4||ou===3){ou=0,ye();var e=su,t=cu,n=lu,r=fu;t.subtreeFlags&10256||t.flags&10256?ou=5:(ou=0,cu=su=null,Uu(e,e.pendingLanes));var i=e.pendingLanes;if(i===0&&(au=null),Ze(n),t=t.stateNode,Ae&&typeof Ae.onCommitFiberRoot==`function`)try{Ae.onCommitFiberRoot(ke,t,void 0,(t.current.flags&128)==128)}catch{}if(r!==null){t=P.T,i=F.p,F.p=2,P.T=null;try{for(var a=e.onRecoverableError,o=0;o<r.length;o++){var s=r[o];a(s.value,{componentStack:s.stack})}}finally{P.T=t,F.p=i}}lu&3&&Wu(),od(e),i=e.pendingLanes,n&261930&&i&42?e===mu?pu++:(pu=0,mu=e):pu=0,sd(0,!1)}}function Uu(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,aa(t)))}function Wu(){return Bu(),Vu(),Hu(),Gu()}function Gu(){if(ou!==5)return!1;var e=su,t=uu;uu=0;var n=Ze(lu),r=P.T,a=F.p;try{F.p=32>n?32:n,P.T=null,n=du,du=null;var o=su,s=lu;if(ou=0,cu=su=null,lu=0,Rl&6)throw Error(i(331));var c=Rl;if(Rl|=4,Nl(o.current),Tl(o,o.current,s,n),Rl=c,sd(0,!1),Ae&&typeof Ae.onPostCommitFiberRoot==`function`)try{Ae.onPostCommitFiberRoot(ke,o)}catch{}return!0}finally{F.p=a,P.T=r,Uu(e,t)}}function Ku(e,t,n){t=pi(n,t),t=Xs(e.stateNode,t,2),e=za(e,t,2),e!==null&&(Ge(e,2),od(e))}function qu(e,t,n){if(e.tag===3)Ku(e,e,n);else for(;t!==null;){if(t.tag===3){Ku(t,e,n);break}else if(t.tag===1){var r=t.stateNode;if(typeof t.type.getDerivedStateFromError==`function`||typeof r.componentDidCatch==`function`&&(au===null||!au.has(r))){e=pi(n,e),n=Zs(2),r=za(t,n,2),r!==null&&(Qs(n,r,t,e),Ge(r,2),od(r));break}}t=t.return}}function Ju(e,t,n){var r=e.pingCache;if(r===null){r=e.pingCache=new Ll;var i=new Set;r.set(t,i)}else i=r.get(t),i===void 0&&(i=new Set,r.set(t,i));i.has(n)||(Wl=!0,i.add(n),e=Yu.bind(null,e,t,n),t.then(e,e))}function Yu(e,t,n){var r=e.pingCache;r!==null&&r.delete(t),e.pingedLanes|=e.suspendedLanes&n,e.warmLanes&=~n,zl===e&&(J&n)===n&&(Kl===4||Kl===3&&(J&62914560)===J&&300>be()-tu?!(Rl&2)&&wu(e,0):Yl|=n,Zl===J&&(Zl=0)),od(e)}function Xu(e,t){t===0&&(t=Ue()),e=Qr(e,t),e!==null&&(Ge(e,t),od(e))}function Zu(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),Xu(e,n)}function Qu(e,t){var n=0;switch(e.tag){case 31:case 13:var r=e.stateNode,a=e.memoizedState;a!==null&&(n=a.retryLane);break;case 19:r=e.stateNode;break;case 22:r=e.stateNode._retryCache;break;default:throw Error(i(314))}r!==null&&r.delete(t),Xu(e,n)}function $u(e,t){return _e(e,t)}var ed=null,td=null,nd=!1,rd=!1,id=!1,ad=0;function od(e){e!==td&&e.next===null&&(td===null?ed=td=e:td=td.next=e),rd=!0,nd||(nd=!0,pd())}function sd(e,t){if(!id&&rd){id=!0;do for(var n=!1,r=ed;r!==null;){if(!t)if(e!==0){var i=r.pendingLanes;if(i===0)var a=0;else{var o=r.suspendedLanes,s=r.pingedLanes;a=(1<<31-Me(42|e)+1)-1,a&=i&~(o&~s),a=a&201326741?a&201326741|1:a?a|2:0}a!==0&&(n=!0,fd(r,a))}else a=J,a=Be(r,r===zl?a:0,r.cancelPendingCommit!==null||r.timeoutHandle!==-1),!(a&3)||Ve(r,a)||(n=!0,fd(r,a));r=r.next}while(n);id=!1}}function cd(){ld()}function ld(){rd=nd=!1;var e=0;ad!==0&&Yd()&&(e=ad);for(var t=be(),n=null,r=ed;r!==null;){var i=r.next,a=ud(r,t);a===0?(r.next=null,n===null?ed=i:n.next=i,i===null&&(td=n)):(n=r,(e!==0||a&3)&&(rd=!0)),r=i}ou!==0&&ou!==5||sd(e,!1),ad!==0&&(ad=0)}function ud(e,t){for(var n=e.suspendedLanes,r=e.pingedLanes,i=e.expirationTimes,a=e.pendingLanes&-62914561;0<a;){var o=31-Me(a),s=1<<o,c=i[o];c===-1?((s&n)===0||(s&r)!==0)&&(i[o]=He(s,t)):c<=t&&(e.expiredLanes|=s),a&=~s}if(t=zl,n=J,n=Be(e,e===t?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),r=e.callbackNode,n===0||e===t&&(Bl===2||Bl===9)||e.cancelPendingCommit!==null)return r!==null&&r!==null&&U(r),e.callbackNode=null,e.callbackPriority=0;if(!(n&3)||Ve(e,n)){if(t=n&-n,t===e.callbackPriority)return t;switch(r!==null&&U(r),Ze(n)){case 2:case 8:n=Ce;break;case 32:n=we;break;case 268435456:n=Ee;break;default:n=we}return r=dd.bind(null,e),n=_e(n,r),e.callbackPriority=t,e.callbackNode=n,t}return r!==null&&r!==null&&U(r),e.callbackPriority=2,e.callbackNode=null,2}function dd(e,t){if(ou!==0&&ou!==5)return e.callbackNode=null,e.callbackPriority=0,null;var n=e.callbackNode;if(Wu()&&e.callbackNode!==n)return null;var r=J;return r=Be(e,e===zl?r:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),r===0?null:(vu(e,r,t),ud(e,be()),e.callbackNode!=null&&e.callbackNode===n?dd.bind(null,e):null)}function fd(e,t){if(Wu())return null;vu(e,t,!0)}function pd(){$d(function(){Rl&6?_e(Se,cd):ld()})}function md(){if(ad===0){var e=ca;e===0&&(e=Ie,Ie<<=1,!(Ie&261888)&&(Ie=256)),ad=e}return ad}function hd(e){return e==null||typeof e==`symbol`||typeof e==`boolean`?null:typeof e==`function`?e:qt(``+e)}function gd(e,t){var n=t.ownerDocument.createElement(`input`);return n.name=t.name,n.value=t.value,e.id&&n.setAttribute(`form`,e.id),t.parentNode.insertBefore(n,t),e=new FormData(e),n.parentNode.removeChild(n),e}function _d(e,t,n,r,i){if(t===`submit`&&n&&n.stateNode===i){var a=hd((i[nt]||null).action),o=r.submitter;o&&(t=(t=o[nt]||null)?hd(t.formAction):o.getAttribute(`formAction`),t!==null&&(a=t,o=null));var s=new gn(`action`,`action`,null,r,i);e.push({event:s,listeners:[{instance:null,listener:function(){if(r.defaultPrevented){if(ad!==0){var e=o?gd(i,o):new FormData(i);Ss(n,{pending:!0,data:e,method:i.method,action:a},null,e)}}else typeof a==`function`&&(s.preventDefault(),e=o?gd(i,o):new FormData(i),Ss(n,{pending:!0,data:e,method:i.method,action:a},a,e))},currentTarget:i}]})}}for(var vd=0;vd<Ur.length;vd++){var yd=Ur[vd];Wr(yd.toLowerCase(),`on`+(yd[0].toUpperCase()+yd.slice(1)))}Wr(Fr,`onAnimationEnd`),Wr(Ir,`onAnimationIteration`),Wr(Lr,`onAnimationStart`),Wr(`dblclick`,`onDoubleClick`),Wr(`focusin`,`onFocus`),Wr(`focusout`,`onBlur`),Wr(Rr,`onTransitionRun`),Wr(zr,`onTransitionStart`),Wr(Br,`onTransitionCancel`),Wr(Vr,`onTransitionEnd`),vt(`onMouseEnter`,[`mouseout`,`mouseover`]),vt(`onMouseLeave`,[`mouseout`,`mouseover`]),vt(`onPointerEnter`,[`pointerout`,`pointerover`]),vt(`onPointerLeave`,[`pointerout`,`pointerover`]),_t(`onChange`,`change click focusin focusout input keydown keyup selectionchange`.split(` `)),_t(`onSelect`,`focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange`.split(` `)),_t(`onBeforeInput`,[`compositionend`,`keypress`,`textInput`,`paste`]),_t(`onCompositionEnd`,`compositionend focusout keydown keypress keyup mousedown`.split(` `)),_t(`onCompositionStart`,`compositionstart focusout keydown keypress keyup mousedown`.split(` `)),_t(`onCompositionUpdate`,`compositionupdate focusout keydown keypress keyup mousedown`.split(` `));var bd=`abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting`.split(` `),xd=new Set(`beforetoggle cancel close invalid load scroll scrollend toggle`.split(` `).concat(bd));function Sd(e,t){t=(t&4)!=0;for(var n=0;n<e.length;n++){var r=e[n],i=r.event;r=r.listeners;a:{var a=void 0;if(t)for(var o=r.length-1;0<=o;o--){var s=r[o],c=s.instance,l=s.currentTarget;if(s=s.listener,c!==a&&i.isPropagationStopped())break a;a=s,i.currentTarget=l;try{a(i)}catch(e){Gr(e)}i.currentTarget=null,a=c}else for(o=0;o<r.length;o++){if(s=r[o],c=s.instance,l=s.currentTarget,s=s.listener,c!==a&&i.isPropagationStopped())break a;a=s,i.currentTarget=l;try{a(i)}catch(e){Gr(e)}i.currentTarget=null,a=c}}}}function Y(e,t){var n=t[it];n===void 0&&(n=t[it]=new Set);var r=e+`__bubble`;n.has(r)||(Ed(t,e,2,!1),n.add(r))}function Cd(e,t,n){var r=0;t&&(r|=4),Ed(n,e,r,t)}var wd=`_reactListening`+Math.random().toString(36).slice(2);function Td(e){if(!e[wd]){e[wd]=!0,ht.forEach(function(t){t!==`selectionchange`&&(xd.has(t)||Cd(t,!1,e),Cd(t,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[wd]||(t[wd]=!0,Cd(`selectionchange`,!1,t))}}function Ed(e,t,n,r){switch(gp(t)){case 2:var i=up;break;case 8:i=dp;break;default:i=fp}n=i.bind(null,t,n,e),i=void 0,!an||t!==`touchstart`&&t!==`touchmove`&&t!==`wheel`||(i=!0),r?i===void 0?e.addEventListener(t,n,!0):e.addEventListener(t,n,{capture:!0,passive:i}):i===void 0?e.addEventListener(t,n,!1):e.addEventListener(t,n,{passive:i})}function Dd(e,t,n,r,i){var a=r;if(!(t&1)&&!(t&2)&&r!==null)a:for(;;){if(r===null)return;var s=r.tag;if(s===3||s===4){var c=r.stateNode.containerInfo;if(c===i)break;if(s===4)for(s=r.return;s!==null;){var l=s.tag;if((l===3||l===4)&&s.stateNode.containerInfo===i)return;s=s.return}for(;c!==null;){if(s=ut(c),s===null)return;if(l=s.tag,l===5||l===6||l===26||l===27){r=a=s;continue a}c=c.parentNode}}r=r.return}tn(function(){var r=a,i=Xt(n),s=[];a:{var c=Hr.get(e);if(c!==void 0){var l=gn,u=e;switch(e){case`keypress`:if(dn(n)===0)break a;case`keydown`:case`keyup`:l=Pn;break;case`focusin`:u=`focus`,l=Tn;break;case`focusout`:u=`blur`,l=Tn;break;case`beforeblur`:case`afterblur`:l=Tn;break;case`click`:if(n.button===2)break a;case`auxclick`:case`dblclick`:case`mousedown`:case`mousemove`:case`mouseup`:case`mouseout`:case`mouseover`:case`contextmenu`:l=Cn;break;case`drag`:case`dragend`:case`dragenter`:case`dragexit`:case`dragleave`:case`dragover`:case`dragstart`:case`drop`:l=wn;break;case`touchcancel`:case`touchend`:case`touchmove`:case`touchstart`:l=In;break;case Fr:case Ir:case Lr:l=En;break;case Vr:l=Ln;break;case`scroll`:case`scrollend`:l=vn;break;case`wheel`:l=Rn;break;case`copy`:case`cut`:case`paste`:l=Dn;break;case`gotpointercapture`:case`lostpointercapture`:case`pointercancel`:case`pointerdown`:case`pointermove`:case`pointerout`:case`pointerover`:case`pointerup`:l=Fn;break;case`toggle`:case`beforetoggle`:l=zn}var d=(t&4)!=0,f=!d&&(e===`scroll`||e===`scrollend`),p=d?c===null?null:c+`Capture`:c;d=[];for(var m=r,h;m!==null;){var g=m;if(h=g.stateNode,g=g.tag,g!==5&&g!==26&&g!==27||h===null||p===null||(g=nn(m,p),g!=null&&d.push(Od(m,g,h))),f)break;m=m.return}0<d.length&&(c=new l(c,u,null,n,i),s.push({event:c,listeners:d}))}}if(!(t&7)){a:{if(c=e===`mouseover`||e===`pointerover`,l=e===`mouseout`||e===`pointerout`,c&&n!==Yt&&(u=n.relatedTarget||n.fromElement)&&(ut(u)||u[rt]))break a;if((l||c)&&(c=i.window===i?i:(c=i.ownerDocument)?c.defaultView||c.parentWindow:window,l?(u=n.relatedTarget||n.toElement,l=r,u=u?ut(u):null,u!==null&&(f=o(u),d=u.tag,u!==f||d!==5&&d!==27&&d!==6)&&(u=null)):(l=null,u=r),l!==u)){if(d=Cn,g=`onMouseLeave`,p=`onMouseEnter`,m=`mouse`,(e===`pointerout`||e===`pointerover`)&&(d=Fn,g=`onPointerLeave`,p=`onPointerEnter`,m=`pointer`),f=l==null?c:ft(l),h=u==null?c:ft(u),c=new d(g,m+`leave`,l,n,i),c.target=f,c.relatedTarget=h,g=null,ut(i)===r&&(d=new d(p,m+`enter`,u,n,i),d.target=h,d.relatedTarget=f,g=d),f=g,l&&u)b:{for(d=Ad,p=l,m=u,h=0,g=p;g;g=d(g))h++;g=0;for(var _=m;_;_=d(_))g++;for(;0<h-g;)p=d(p),h--;for(;0<g-h;)m=d(m),g--;for(;h--;){if(p===m||m!==null&&p===m.alternate){d=p;break b}p=d(p),m=d(m)}d=null}else d=null;l!==null&&jd(s,c,l,d,!1),u!==null&&f!==null&&jd(s,f,u,d,!0)}}a:{if(c=r?ft(r):window,l=c.nodeName&&c.nodeName.toLowerCase(),l===`select`||l===`input`&&c.type===`file`)var v=ar;else if($n(c))if(or)v=hr;else{v=pr;var y=fr}else l=c.nodeName,!l||l.toLowerCase()!==`input`||c.type!==`checkbox`&&c.type!==`radio`?r&&Wt(r.elementType)&&(v=ar):v=mr;if(v&&=v(e,r)){er(s,v,n,i);break a}y&&y(e,c,r),e===`focusout`&&r&&c.type===`number`&&r.memoizedProps.value!=null&&It(c,`number`,c.value)}switch(y=r?ft(r):window,e){case`focusin`:($n(y)||y.contentEditable===`true`)&&(Tr=y,Er=r,Dr=null);break;case`focusout`:Dr=Er=Tr=null;break;case`mousedown`:Or=!0;break;case`contextmenu`:case`mouseup`:case`dragend`:Or=!1,kr(s,n,i);break;case`selectionchange`:if(wr)break;case`keydown`:case`keyup`:kr(s,n,i)}var b;if(Vn)b:{switch(e){case`compositionstart`:var x=`onCompositionStart`;break b;case`compositionend`:x=`onCompositionEnd`;break b;case`compositionupdate`:x=`onCompositionUpdate`;break b}x=void 0}else Yn?qn(e,n)&&(x=`onCompositionEnd`):e===`keydown`&&n.keyCode===229&&(x=`onCompositionStart`);x&&(Wn&&n.locale!==`ko`&&(Yn||x!==`onCompositionStart`?x===`onCompositionEnd`&&Yn&&(b=un()):(sn=i,cn=`value`in sn?sn.value:sn.textContent,Yn=!0)),y=kd(r,x),0<y.length&&(x=new On(x,e,null,n,i),s.push({event:x,listeners:y}),b?x.data=b:(b=Jn(n),b!==null&&(x.data=b)))),(b=Un?Xn(e,n):Zn(e,n))&&(x=kd(r,`onBeforeInput`),0<x.length&&(y=new On(`onBeforeInput`,`beforeinput`,null,n,i),s.push({event:y,listeners:x}),y.data=b)),_d(s,e,r,n,i)}Sd(s,t)})}function Od(e,t,n){return{instance:e,listener:t,currentTarget:n}}function kd(e,t){for(var n=t+`Capture`,r=[];e!==null;){var i=e,a=i.stateNode;if(i=i.tag,i!==5&&i!==26&&i!==27||a===null||(i=nn(e,n),i!=null&&r.unshift(Od(e,i,a)),i=nn(e,t),i!=null&&r.push(Od(e,i,a))),e.tag===3)return r;e=e.return}return[]}function Ad(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function jd(e,t,n,r,i){for(var a=t._reactName,o=[];n!==null&&n!==r;){var s=n,c=s.alternate,l=s.stateNode;if(s=s.tag,c!==null&&c===r)break;s!==5&&s!==26&&s!==27||l===null||(c=l,i?(l=nn(n,a),l!=null&&o.unshift(Od(n,l,c))):i||(l=nn(n,a),l!=null&&o.push(Od(n,l,c)))),n=n.return}o.length!==0&&e.push({event:t,listeners:o})}var Md=/\r\n?/g,Nd=/\u0000|\uFFFD/g;function Pd(e){return(typeof e==`string`?e:``+e).replace(Md,`
`).replace(Nd,``)}function Fd(e,t){return t=Pd(t),Pd(e)===t}function Id(e,t,n,r,a,o){switch(n){case`children`:typeof r==`string`?t===`body`||t===`textarea`&&r===``||Bt(e,r):(typeof r==`number`||typeof r==`bigint`)&&t!==`body`&&Bt(e,``+r);break;case`className`:wt(e,`class`,r);break;case`tabIndex`:wt(e,`tabindex`,r);break;case`dir`:case`role`:case`viewBox`:case`width`:case`height`:wt(e,n,r);break;case`style`:Ut(e,r,o);break;case`data`:if(t!==`object`){wt(e,`data`,r);break}case`src`:case`href`:if(r===``&&(t!==`a`||n!==`href`)){e.removeAttribute(n);break}if(r==null||typeof r==`function`||typeof r==`symbol`||typeof r==`boolean`){e.removeAttribute(n);break}r=qt(``+r),e.setAttribute(n,r);break;case`action`:case`formAction`:if(typeof r==`function`){e.setAttribute(n,`javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')`);break}else typeof o==`function`&&(n===`formAction`?(t!==`input`&&Id(e,t,`name`,a.name,a,null),Id(e,t,`formEncType`,a.formEncType,a,null),Id(e,t,`formMethod`,a.formMethod,a,null),Id(e,t,`formTarget`,a.formTarget,a,null)):(Id(e,t,`encType`,a.encType,a,null),Id(e,t,`method`,a.method,a,null),Id(e,t,`target`,a.target,a,null)));if(r==null||typeof r==`symbol`||typeof r==`boolean`){e.removeAttribute(n);break}r=qt(``+r),e.setAttribute(n,r);break;case`onClick`:r!=null&&(e.onclick=Jt);break;case`onScroll`:r!=null&&Y(`scroll`,e);break;case`onScrollEnd`:r!=null&&Y(`scrollend`,e);break;case`dangerouslySetInnerHTML`:if(r!=null){if(typeof r!=`object`||!(`__html`in r))throw Error(i(61));if(n=r.__html,n!=null){if(a.children!=null)throw Error(i(60));e.innerHTML=n}}break;case`multiple`:e.multiple=r&&typeof r!=`function`&&typeof r!=`symbol`;break;case`muted`:e.muted=r&&typeof r!=`function`&&typeof r!=`symbol`;break;case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`defaultValue`:case`defaultChecked`:case`innerHTML`:case`ref`:break;case`autoFocus`:break;case`xlinkHref`:if(r==null||typeof r==`function`||typeof r==`boolean`||typeof r==`symbol`){e.removeAttribute(`xlink:href`);break}n=qt(``+r),e.setAttributeNS(`http://www.w3.org/1999/xlink`,`xlink:href`,n);break;case`contentEditable`:case`spellCheck`:case`draggable`:case`value`:case`autoReverse`:case`externalResourcesRequired`:case`focusable`:case`preserveAlpha`:r!=null&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,``+r):e.removeAttribute(n);break;case`inert`:case`allowFullScreen`:case`async`:case`autoPlay`:case`controls`:case`default`:case`defer`:case`disabled`:case`disablePictureInPicture`:case`disableRemotePlayback`:case`formNoValidate`:case`hidden`:case`loop`:case`noModule`:case`noValidate`:case`open`:case`playsInline`:case`readOnly`:case`required`:case`reversed`:case`scoped`:case`seamless`:case`itemScope`:r&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,``):e.removeAttribute(n);break;case`capture`:case`download`:!0===r?e.setAttribute(n,``):!1!==r&&r!=null&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,r):e.removeAttribute(n);break;case`cols`:case`rows`:case`size`:case`span`:r!=null&&typeof r!=`function`&&typeof r!=`symbol`&&!isNaN(r)&&1<=r?e.setAttribute(n,r):e.removeAttribute(n);break;case`rowSpan`:case`start`:r==null||typeof r==`function`||typeof r==`symbol`||isNaN(r)?e.removeAttribute(n):e.setAttribute(n,r);break;case`popover`:Y(`beforetoggle`,e),Y(`toggle`,e),Ct(e,`popover`,r);break;case`xlinkActuate`:Tt(e,`http://www.w3.org/1999/xlink`,`xlink:actuate`,r);break;case`xlinkArcrole`:Tt(e,`http://www.w3.org/1999/xlink`,`xlink:arcrole`,r);break;case`xlinkRole`:Tt(e,`http://www.w3.org/1999/xlink`,`xlink:role`,r);break;case`xlinkShow`:Tt(e,`http://www.w3.org/1999/xlink`,`xlink:show`,r);break;case`xlinkTitle`:Tt(e,`http://www.w3.org/1999/xlink`,`xlink:title`,r);break;case`xlinkType`:Tt(e,`http://www.w3.org/1999/xlink`,`xlink:type`,r);break;case`xmlBase`:Tt(e,`http://www.w3.org/XML/1998/namespace`,`xml:base`,r);break;case`xmlLang`:Tt(e,`http://www.w3.org/XML/1998/namespace`,`xml:lang`,r);break;case`xmlSpace`:Tt(e,`http://www.w3.org/XML/1998/namespace`,`xml:space`,r);break;case`is`:Ct(e,`is`,r);break;case`innerText`:case`textContent`:break;default:(!(2<n.length)||n[0]!==`o`&&n[0]!==`O`||n[1]!==`n`&&n[1]!==`N`)&&(n=Gt.get(n)||n,Ct(e,n,r))}}function Ld(e,t,n,r,a,o){switch(n){case`style`:Ut(e,r,o);break;case`dangerouslySetInnerHTML`:if(r!=null){if(typeof r!=`object`||!(`__html`in r))throw Error(i(61));if(n=r.__html,n!=null){if(a.children!=null)throw Error(i(60));e.innerHTML=n}}break;case`children`:typeof r==`string`?Bt(e,r):(typeof r==`number`||typeof r==`bigint`)&&Bt(e,``+r);break;case`onScroll`:r!=null&&Y(`scroll`,e);break;case`onScrollEnd`:r!=null&&Y(`scrollend`,e);break;case`onClick`:r!=null&&(e.onclick=Jt);break;case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`innerHTML`:case`ref`:break;case`innerText`:case`textContent`:break;default:if(!gt.hasOwnProperty(n))a:{if(n[0]===`o`&&n[1]===`n`&&(a=n.endsWith(`Capture`),t=n.slice(2,a?n.length-7:void 0),o=e[nt]||null,o=o==null?null:o[n],typeof o==`function`&&e.removeEventListener(t,o,a),typeof r==`function`)){typeof o!=`function`&&o!==null&&(n in e?e[n]=null:e.hasAttribute(n)&&e.removeAttribute(n)),e.addEventListener(t,r,a);break a}n in e?e[n]=r:!0===r?e.setAttribute(n,``):Ct(e,n,r)}}}function Rd(e,t,n){switch(t){case`div`:case`span`:case`svg`:case`path`:case`a`:case`g`:case`p`:case`li`:break;case`img`:Y(`error`,e),Y(`load`,e);var r=!1,a=!1,o;for(o in n)if(n.hasOwnProperty(o)){var s=n[o];if(s!=null)switch(o){case`src`:r=!0;break;case`srcSet`:a=!0;break;case`children`:case`dangerouslySetInnerHTML`:throw Error(i(137,t));default:Id(e,t,o,s,n,null)}}a&&Id(e,t,`srcSet`,n.srcSet,n,null),r&&Id(e,t,`src`,n.src,n,null);return;case`input`:Y(`invalid`,e);var c=o=s=a=null,l=null,u=null;for(r in n)if(n.hasOwnProperty(r)){var d=n[r];if(d!=null)switch(r){case`name`:a=d;break;case`type`:s=d;break;case`checked`:l=d;break;case`defaultChecked`:u=d;break;case`value`:o=d;break;case`defaultValue`:c=d;break;case`children`:case`dangerouslySetInnerHTML`:if(d!=null)throw Error(i(137,t));break;default:Id(e,t,r,d,n,null)}}Ft(e,o,c,l,u,s,a,!1);return;case`select`:for(a in Y(`invalid`,e),r=s=o=null,n)if(n.hasOwnProperty(a)&&(c=n[a],c!=null))switch(a){case`value`:o=c;break;case`defaultValue`:s=c;break;case`multiple`:r=c;default:Id(e,t,a,c,n,null)}t=o,n=s,e.multiple=!!r,t==null?n!=null&&Lt(e,!!r,n,!0):Lt(e,!!r,t,!1);return;case`textarea`:for(s in Y(`invalid`,e),o=a=r=null,n)if(n.hasOwnProperty(s)&&(c=n[s],c!=null))switch(s){case`value`:r=c;break;case`defaultValue`:a=c;break;case`children`:o=c;break;case`dangerouslySetInnerHTML`:if(c!=null)throw Error(i(91));break;default:Id(e,t,s,c,n,null)}zt(e,r,a,o);return;case`option`:for(l in n)if(n.hasOwnProperty(l)&&(r=n[l],r!=null))switch(l){case`selected`:e.selected=r&&typeof r!=`function`&&typeof r!=`symbol`;break;default:Id(e,t,l,r,n,null)}return;case`dialog`:Y(`beforetoggle`,e),Y(`toggle`,e),Y(`cancel`,e),Y(`close`,e);break;case`iframe`:case`object`:Y(`load`,e);break;case`video`:case`audio`:for(r=0;r<bd.length;r++)Y(bd[r],e);break;case`image`:Y(`error`,e),Y(`load`,e);break;case`details`:Y(`toggle`,e);break;case`embed`:case`source`:case`link`:Y(`error`,e),Y(`load`,e);case`area`:case`base`:case`br`:case`col`:case`hr`:case`keygen`:case`meta`:case`param`:case`track`:case`wbr`:case`menuitem`:for(u in n)if(n.hasOwnProperty(u)&&(r=n[u],r!=null))switch(u){case`children`:case`dangerouslySetInnerHTML`:throw Error(i(137,t));default:Id(e,t,u,r,n,null)}return;default:if(Wt(t)){for(d in n)n.hasOwnProperty(d)&&(r=n[d],r!==void 0&&Ld(e,t,d,r,n,void 0));return}}for(c in n)n.hasOwnProperty(c)&&(r=n[c],r!=null&&Id(e,t,c,r,n,null))}function zd(e,t,n,r){switch(t){case`div`:case`span`:case`svg`:case`path`:case`a`:case`g`:case`p`:case`li`:break;case`input`:var a=null,o=null,s=null,c=null,l=null,u=null,d=null;for(m in n){var f=n[m];if(n.hasOwnProperty(m)&&f!=null)switch(m){case`checked`:break;case`value`:break;case`defaultValue`:l=f;default:r.hasOwnProperty(m)||Id(e,t,m,null,r,f)}}for(var p in r){var m=r[p];if(f=n[p],r.hasOwnProperty(p)&&(m!=null||f!=null))switch(p){case`type`:o=m;break;case`name`:a=m;break;case`checked`:u=m;break;case`defaultChecked`:d=m;break;case`value`:s=m;break;case`defaultValue`:c=m;break;case`children`:case`dangerouslySetInnerHTML`:if(m!=null)throw Error(i(137,t));break;default:m!==f&&Id(e,t,p,m,r,f)}}Pt(e,s,c,l,u,d,o,a);return;case`select`:for(o in m=s=c=p=null,n)if(l=n[o],n.hasOwnProperty(o)&&l!=null)switch(o){case`value`:break;case`multiple`:m=l;default:r.hasOwnProperty(o)||Id(e,t,o,null,r,l)}for(a in r)if(o=r[a],l=n[a],r.hasOwnProperty(a)&&(o!=null||l!=null))switch(a){case`value`:p=o;break;case`defaultValue`:c=o;break;case`multiple`:s=o;default:o!==l&&Id(e,t,a,o,r,l)}t=c,n=s,r=m,p==null?!!r!=!!n&&(t==null?Lt(e,!!n,n?[]:``,!1):Lt(e,!!n,t,!0)):Lt(e,!!n,p,!1);return;case`textarea`:for(c in m=p=null,n)if(a=n[c],n.hasOwnProperty(c)&&a!=null&&!r.hasOwnProperty(c))switch(c){case`value`:break;case`children`:break;default:Id(e,t,c,null,r,a)}for(s in r)if(a=r[s],o=n[s],r.hasOwnProperty(s)&&(a!=null||o!=null))switch(s){case`value`:p=a;break;case`defaultValue`:m=a;break;case`children`:break;case`dangerouslySetInnerHTML`:if(a!=null)throw Error(i(91));break;default:a!==o&&Id(e,t,s,a,r,o)}Rt(e,p,m);return;case`option`:for(var h in n)if(p=n[h],n.hasOwnProperty(h)&&p!=null&&!r.hasOwnProperty(h))switch(h){case`selected`:e.selected=!1;break;default:Id(e,t,h,null,r,p)}for(l in r)if(p=r[l],m=n[l],r.hasOwnProperty(l)&&p!==m&&(p!=null||m!=null))switch(l){case`selected`:e.selected=p&&typeof p!=`function`&&typeof p!=`symbol`;break;default:Id(e,t,l,p,r,m)}return;case`img`:case`link`:case`area`:case`base`:case`br`:case`col`:case`embed`:case`hr`:case`keygen`:case`meta`:case`param`:case`source`:case`track`:case`wbr`:case`menuitem`:for(var g in n)p=n[g],n.hasOwnProperty(g)&&p!=null&&!r.hasOwnProperty(g)&&Id(e,t,g,null,r,p);for(u in r)if(p=r[u],m=n[u],r.hasOwnProperty(u)&&p!==m&&(p!=null||m!=null))switch(u){case`children`:case`dangerouslySetInnerHTML`:if(p!=null)throw Error(i(137,t));break;default:Id(e,t,u,p,r,m)}return;default:if(Wt(t)){for(var _ in n)p=n[_],n.hasOwnProperty(_)&&p!==void 0&&!r.hasOwnProperty(_)&&Ld(e,t,_,void 0,r,p);for(d in r)p=r[d],m=n[d],!r.hasOwnProperty(d)||p===m||p===void 0&&m===void 0||Ld(e,t,d,p,r,m);return}}for(var v in n)p=n[v],n.hasOwnProperty(v)&&p!=null&&!r.hasOwnProperty(v)&&Id(e,t,v,null,r,p);for(f in r)p=r[f],m=n[f],!r.hasOwnProperty(f)||p===m||p==null&&m==null||Id(e,t,f,p,r,m)}function Bd(e){switch(e){case`css`:case`script`:case`font`:case`img`:case`image`:case`input`:case`link`:return!0;default:return!1}}function Vd(){if(typeof performance.getEntriesByType==`function`){for(var e=0,t=0,n=performance.getEntriesByType(`resource`),r=0;r<n.length;r++){var i=n[r],a=i.transferSize,o=i.initiatorType,s=i.duration;if(a&&s&&Bd(o)){for(o=0,s=i.responseEnd,r+=1;r<n.length;r++){var c=n[r],l=c.startTime;if(l>s)break;var u=c.transferSize,d=c.initiatorType;u&&Bd(d)&&(c=c.responseEnd,o+=u*(c<s?1:(s-l)/(c-l)))}if(--r,t+=8*(a+o)/(i.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e==`number`)?e:5}var Hd=null,Ud=null;function Wd(e){return e.nodeType===9?e:e.ownerDocument}function Gd(e){switch(e){case`http://www.w3.org/2000/svg`:return 1;case`http://www.w3.org/1998/Math/MathML`:return 2;default:return 0}}function Kd(e,t){if(e===0)switch(t){case`svg`:return 1;case`math`:return 2;default:return 0}return e===1&&t===`foreignObject`?0:e}function qd(e,t){return e===`textarea`||e===`noscript`||typeof t.children==`string`||typeof t.children==`number`||typeof t.children==`bigint`||typeof t.dangerouslySetInnerHTML==`object`&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var Jd=null;function Yd(){var e=window.event;return e&&e.type===`popstate`?e===Jd?!1:(Jd=e,!0):(Jd=null,!1)}var Xd=typeof setTimeout==`function`?setTimeout:void 0,Zd=typeof clearTimeout==`function`?clearTimeout:void 0,Qd=typeof Promise==`function`?Promise:void 0,$d=typeof queueMicrotask==`function`?queueMicrotask:Qd===void 0?Xd:function(e){return Qd.resolve(null).then(e).catch(ef)};function ef(e){setTimeout(function(){throw e})}function tf(e){return e===`head`}function nf(e,t){var n=t,r=0;do{var i=n.nextSibling;if(e.removeChild(n),i&&i.nodeType===8)if(n=i.data,n===`/$`||n===`/&`){if(r===0){e.removeChild(i),Fp(t);return}r--}else if(n===`$`||n===`$?`||n===`$~`||n===`$!`||n===`&`)r++;else if(n===`html`)hf(e.ownerDocument.documentElement);else if(n===`head`){n=e.ownerDocument.head,hf(n);for(var a=n.firstChild;a;){var o=a.nextSibling,s=a.nodeName;a[ct]||s===`SCRIPT`||s===`STYLE`||s===`LINK`&&a.rel.toLowerCase()===`stylesheet`||n.removeChild(a),a=o}}else n===`body`&&hf(e.ownerDocument.body);n=i}while(n);Fp(t)}function rf(e,t){var n=e;e=0;do{var r=n.nextSibling;if(n.nodeType===1?t?(n._stashedDisplay=n.style.display,n.style.display=`none`):(n.style.display=n._stashedDisplay||``,n.getAttribute(`style`)===``&&n.removeAttribute(`style`)):n.nodeType===3&&(t?(n._stashedText=n.nodeValue,n.nodeValue=``):n.nodeValue=n._stashedText||``),r&&r.nodeType===8)if(n=r.data,n===`/$`){if(e===0)break;e--}else n!==`$`&&n!==`$?`&&n!==`$~`&&n!==`$!`||e++;n=r}while(n)}function af(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var n=t;switch(t=t.nextSibling,n.nodeName){case`HTML`:case`HEAD`:case`BODY`:af(n),lt(n);continue;case`SCRIPT`:case`STYLE`:continue;case`LINK`:if(n.rel.toLowerCase()===`stylesheet`)continue}e.removeChild(n)}}function of(e,t,n,r){for(;e.nodeType===1;){var i=n;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!r&&(e.nodeName!==`INPUT`||e.type!==`hidden`))break}else if(!r)if(t===`input`&&e.type===`hidden`){var a=i.name==null?null:``+i.name;if(i.type===`hidden`&&e.getAttribute(`name`)===a)return e}else return e;else if(!e[ct])switch(t){case`meta`:if(!e.hasAttribute(`itemprop`))break;return e;case`link`:if(a=e.getAttribute(`rel`),a===`stylesheet`&&e.hasAttribute(`data-precedence`)||a!==i.rel||e.getAttribute(`href`)!==(i.href==null||i.href===``?null:i.href)||e.getAttribute(`crossorigin`)!==(i.crossOrigin==null?null:i.crossOrigin)||e.getAttribute(`title`)!==(i.title==null?null:i.title))break;return e;case`style`:if(e.hasAttribute(`data-precedence`))break;return e;case`script`:if(a=e.getAttribute(`src`),(a!==(i.src==null?null:i.src)||e.getAttribute(`type`)!==(i.type==null?null:i.type)||e.getAttribute(`crossorigin`)!==(i.crossOrigin==null?null:i.crossOrigin))&&a&&e.hasAttribute(`async`)&&!e.hasAttribute(`itemprop`))break;return e;default:return e}if(e=uf(e.nextSibling),e===null)break}return null}function X(e,t,n){if(t===``)return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!==`INPUT`||e.type!==`hidden`)&&!n||(e=uf(e.nextSibling),e===null))return null;return e}function sf(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!==`INPUT`||e.type!==`hidden`)&&!t||(e=uf(e.nextSibling),e===null))return null;return e}function cf(e){return e.data===`$?`||e.data===`$~`}function Z(e){return e.data===`$!`||e.data===`$?`&&e.ownerDocument.readyState!==`loading`}function lf(e,t){var n=e.ownerDocument;if(e.data===`$~`)e._reactRetry=t;else if(e.data!==`$?`||n.readyState!==`loading`)t();else{var r=function(){t(),n.removeEventListener(`DOMContentLoaded`,r)};n.addEventListener(`DOMContentLoaded`,r),e._reactRetry=r}}function uf(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t===`$`||t===`$!`||t===`$?`||t===`$~`||t===`&`||t===`F!`||t===`F`)break;if(t===`/$`||t===`/&`)return null}}return e}var df=null;function ff(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n===`/$`||n===`/&`){if(t===0)return uf(e.nextSibling);t--}else n!==`$`&&n!==`$!`&&n!==`$?`&&n!==`$~`&&n!==`&`||t++}e=e.nextSibling}return null}function pf(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n===`$`||n===`$!`||n===`$?`||n===`$~`||n===`&`){if(t===0)return e;t--}else n!==`/$`&&n!==`/&`||t++}e=e.previousSibling}return null}function mf(e,t,n){switch(t=Wd(n),e){case`html`:if(e=t.documentElement,!e)throw Error(i(452));return e;case`head`:if(e=t.head,!e)throw Error(i(453));return e;case`body`:if(e=t.body,!e)throw Error(i(454));return e;default:throw Error(i(451))}}function hf(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);lt(e)}var gf=new Map,_f=new Set;function vf(e){return typeof e.getRootNode==`function`?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var yf=F.d;F.d={f:bf,r:xf,D:wf,C:Tf,L:Ef,m:Df,X:kf,S:Of,M:Af};function bf(){var e=yf.f(),t=Su();return e||t}function xf(e){var t=dt(e);t!==null&&t.tag===5&&t.type===`form`?ws(t):yf.r(e)}var Sf=typeof document>`u`?null:document;function Cf(e,t,n){var r=Sf;if(r&&typeof t==`string`&&t){var i=Nt(t);i=`link[rel="`+e+`"][href="`+i+`"]`,typeof n==`string`&&(i+=`[crossorigin="`+n+`"]`),_f.has(i)||(_f.add(i),e={rel:e,crossOrigin:n,href:t},r.querySelector(i)===null&&(t=r.createElement(`link`),Rd(t,`link`,e),mt(t),r.head.appendChild(t)))}}function wf(e){yf.D(e),Cf(`dns-prefetch`,e,null)}function Tf(e,t){yf.C(e,t),Cf(`preconnect`,e,t)}function Ef(e,t,n){yf.L(e,t,n);var r=Sf;if(r&&e&&t){var i=`link[rel="preload"][as="`+Nt(t)+`"]`;t===`image`&&n&&n.imageSrcSet?(i+=`[imagesrcset="`+Nt(n.imageSrcSet)+`"]`,typeof n.imageSizes==`string`&&(i+=`[imagesizes="`+Nt(n.imageSizes)+`"]`)):i+=`[href="`+Nt(e)+`"]`;var a=i;switch(t){case`style`:a=Mf(e);break;case`script`:a=If(e)}gf.has(a)||(e=m({rel:`preload`,href:t===`image`&&n&&n.imageSrcSet?void 0:e,as:t},n),gf.set(a,e),r.querySelector(i)!==null||t===`style`&&r.querySelector(Nf(a))||t===`script`&&r.querySelector(Lf(a))||(t=r.createElement(`link`),Rd(t,`link`,e),mt(t),r.head.appendChild(t)))}}function Df(e,t){yf.m(e,t);var n=Sf;if(n&&e){var r=t&&typeof t.as==`string`?t.as:`script`,i=`link[rel="modulepreload"][as="`+Nt(r)+`"][href="`+Nt(e)+`"]`,a=i;switch(r){case`audioworklet`:case`paintworklet`:case`serviceworker`:case`sharedworker`:case`worker`:case`script`:a=If(e)}if(!gf.has(a)&&(e=m({rel:`modulepreload`,href:e},t),gf.set(a,e),n.querySelector(i)===null)){switch(r){case`audioworklet`:case`paintworklet`:case`serviceworker`:case`sharedworker`:case`worker`:case`script`:if(n.querySelector(Lf(a)))return}r=n.createElement(`link`),Rd(r,`link`,e),mt(r),n.head.appendChild(r)}}}function Of(e,t,n){yf.S(e,t,n);var r=Sf;if(r&&e){var i=pt(r).hoistableStyles,a=Mf(e);t||=`default`;var o=i.get(a);if(!o){var s={loading:0,preload:null};if(o=r.querySelector(Nf(a)))s.loading=5;else{e=m({rel:`stylesheet`,href:e,"data-precedence":t},n),(n=gf.get(a))&&Bf(e,n);var c=o=r.createElement(`link`);mt(c),Rd(c,`link`,e),c._p=new Promise(function(e,t){c.onload=e,c.onerror=t}),c.addEventListener(`load`,function(){s.loading|=1}),c.addEventListener(`error`,function(){s.loading|=2}),s.loading|=4,zf(o,t,r)}o={type:`stylesheet`,instance:o,count:1,state:s},i.set(a,o)}}}function kf(e,t){yf.X(e,t);var n=Sf;if(n&&e){var r=pt(n).hoistableScripts,i=If(e),a=r.get(i);a||(a=n.querySelector(Lf(i)),a||(e=m({src:e,async:!0},t),(t=gf.get(i))&&Vf(e,t),a=n.createElement(`script`),mt(a),Rd(a,`link`,e),n.head.appendChild(a)),a={type:`script`,instance:a,count:1,state:null},r.set(i,a))}}function Af(e,t){yf.M(e,t);var n=Sf;if(n&&e){var r=pt(n).hoistableScripts,i=If(e),a=r.get(i);a||(a=n.querySelector(Lf(i)),a||(e=m({src:e,async:!0,type:`module`},t),(t=gf.get(i))&&Vf(e,t),a=n.createElement(`script`),mt(a),Rd(a,`link`,e),n.head.appendChild(a)),a={type:`script`,instance:a,count:1,state:null},r.set(i,a))}}function jf(e,t,n,r){var a=(a=ce.current)?vf(a):null;if(!a)throw Error(i(446));switch(e){case`meta`:case`title`:return null;case`style`:return typeof n.precedence==`string`&&typeof n.href==`string`?(t=Mf(n.href),n=pt(a).hoistableStyles,r=n.get(t),r||(r={type:`style`,instance:null,count:0,state:null},n.set(t,r)),r):{type:`void`,instance:null,count:0,state:null};case`link`:if(n.rel===`stylesheet`&&typeof n.href==`string`&&typeof n.precedence==`string`){e=Mf(n.href);var o=pt(a).hoistableStyles,s=o.get(e);if(s||(a=a.ownerDocument||a,s={type:`stylesheet`,instance:null,count:0,state:{loading:0,preload:null}},o.set(e,s),(o=a.querySelector(Nf(e)))&&!o._p&&(s.instance=o,s.state.loading=5),gf.has(e)||(n={rel:`preload`,as:`style`,href:n.href,crossOrigin:n.crossOrigin,integrity:n.integrity,media:n.media,hrefLang:n.hrefLang,referrerPolicy:n.referrerPolicy},gf.set(e,n),o||Ff(a,e,n,s.state))),t&&r===null)throw Error(i(528,``));return s}if(t&&r!==null)throw Error(i(529,``));return null;case`script`:return t=n.async,n=n.src,typeof n==`string`&&t&&typeof t!=`function`&&typeof t!=`symbol`?(t=If(n),n=pt(a).hoistableScripts,r=n.get(t),r||(r={type:`script`,instance:null,count:0,state:null},n.set(t,r)),r):{type:`void`,instance:null,count:0,state:null};default:throw Error(i(444,e))}}function Mf(e){return`href="`+Nt(e)+`"`}function Nf(e){return`link[rel="stylesheet"][`+e+`]`}function Pf(e){return m({},e,{"data-precedence":e.precedence,precedence:null})}function Ff(e,t,n,r){e.querySelector(`link[rel="preload"][as="style"][`+t+`]`)?r.loading=1:(t=e.createElement(`link`),r.preload=t,t.addEventListener(`load`,function(){return r.loading|=1}),t.addEventListener(`error`,function(){return r.loading|=2}),Rd(t,`link`,n),mt(t),e.head.appendChild(t))}function If(e){return`[src="`+Nt(e)+`"]`}function Lf(e){return`script[async]`+e}function Rf(e,t,n){if(t.count++,t.instance===null)switch(t.type){case`style`:var r=e.querySelector(`style[data-href~="`+Nt(n.href)+`"]`);if(r)return t.instance=r,mt(r),r;var a=m({},n,{"data-href":n.href,"data-precedence":n.precedence,href:null,precedence:null});return r=(e.ownerDocument||e).createElement(`style`),mt(r),Rd(r,`style`,a),zf(r,n.precedence,e),t.instance=r;case`stylesheet`:a=Mf(n.href);var o=e.querySelector(Nf(a));if(o)return t.state.loading|=4,t.instance=o,mt(o),o;r=Pf(n),(a=gf.get(a))&&Bf(r,a),o=(e.ownerDocument||e).createElement(`link`),mt(o);var s=o;return s._p=new Promise(function(e,t){s.onload=e,s.onerror=t}),Rd(o,`link`,r),t.state.loading|=4,zf(o,n.precedence,e),t.instance=o;case`script`:return o=If(n.src),(a=e.querySelector(Lf(o)))?(t.instance=a,mt(a),a):(r=n,(a=gf.get(o))&&(r=m({},n),Vf(r,a)),e=e.ownerDocument||e,a=e.createElement(`script`),mt(a),Rd(a,`link`,r),e.head.appendChild(a),t.instance=a);case`void`:return null;default:throw Error(i(443,t.type))}else t.type===`stylesheet`&&!(t.state.loading&4)&&(r=t.instance,t.state.loading|=4,zf(r,n.precedence,e));return t.instance}function zf(e,t,n){for(var r=n.querySelectorAll(`link[rel="stylesheet"][data-precedence],style[data-precedence]`),i=r.length?r[r.length-1]:null,a=i,o=0;o<r.length;o++){var s=r[o];if(s.dataset.precedence===t)a=s;else if(a!==i)break}a?a.parentNode.insertBefore(e,a.nextSibling):(t=n.nodeType===9?n.head:n,t.insertBefore(e,t.firstChild))}function Bf(e,t){e.crossOrigin??=t.crossOrigin,e.referrerPolicy??=t.referrerPolicy,e.title??=t.title}function Vf(e,t){e.crossOrigin??=t.crossOrigin,e.referrerPolicy??=t.referrerPolicy,e.integrity??=t.integrity}var Hf=null;function Uf(e,t,n){if(Hf===null){var r=new Map,i=Hf=new Map;i.set(n,r)}else i=Hf,r=i.get(n),r||(r=new Map,i.set(n,r));if(r.has(e))return r;for(r.set(e,null),n=n.getElementsByTagName(e),i=0;i<n.length;i++){var a=n[i];if(!(a[ct]||a[tt]||e===`link`&&a.getAttribute(`rel`)===`stylesheet`)&&a.namespaceURI!==`http://www.w3.org/2000/svg`){var o=a.getAttribute(t)||``;o=e+o;var s=r.get(o);s?s.push(a):r.set(o,[a])}}return r}function Wf(e,t,n){e=e.ownerDocument||e,e.head.insertBefore(n,t===`title`?e.querySelector(`head > title`):null)}function Gf(e,t,n){if(n===1||t.itemProp!=null)return!1;switch(e){case`meta`:case`title`:return!0;case`style`:if(typeof t.precedence!=`string`||typeof t.href!=`string`||t.href===``)break;return!0;case`link`:if(typeof t.rel!=`string`||typeof t.href!=`string`||t.href===``||t.onLoad||t.onError)break;switch(t.rel){case`stylesheet`:return e=t.disabled,typeof t.precedence==`string`&&e==null;default:return!0}case`script`:if(t.async&&typeof t.async!=`function`&&typeof t.async!=`symbol`&&!t.onLoad&&!t.onError&&t.src&&typeof t.src==`string`)return!0}return!1}function Kf(e){return!(e.type===`stylesheet`&&!(e.state.loading&3))}function qf(e,t,n,r){if(n.type===`stylesheet`&&(typeof r.media!=`string`||!1!==matchMedia(r.media).matches)&&!(n.state.loading&4)){if(n.instance===null){var i=Mf(r.href),a=t.querySelector(Nf(i));if(a){t=a._p,typeof t==`object`&&t&&typeof t.then==`function`&&(e.count++,e=Xf.bind(e),t.then(e,e)),n.state.loading|=4,n.instance=a,mt(a);return}a=t.ownerDocument||t,r=Pf(r),(i=gf.get(i))&&Bf(r,i),a=a.createElement(`link`),mt(a);var o=a;o._p=new Promise(function(e,t){o.onload=e,o.onerror=t}),Rd(a,`link`,r),n.instance=a}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(n,t),(t=n.state.preload)&&!(n.state.loading&3)&&(e.count++,n=Xf.bind(e),t.addEventListener(`load`,n),t.addEventListener(`error`,n))}}var Jf=0;function Yf(e,t){return e.stylesheets&&e.count===0&&Qf(e,e.stylesheets),0<e.count||0<e.imgCount?function(n){var r=setTimeout(function(){if(e.stylesheets&&Qf(e,e.stylesheets),e.unsuspend){var t=e.unsuspend;e.unsuspend=null,t()}},6e4+t);0<e.imgBytes&&Jf===0&&(Jf=62500*Vd());var i=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Qf(e,e.stylesheets),e.unsuspend)){var t=e.unsuspend;e.unsuspend=null,t()}},(e.imgBytes>Jf?50:800)+t);return e.unsuspend=n,function(){e.unsuspend=null,clearTimeout(r),clearTimeout(i)}}:null}function Xf(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Qf(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Zf=null;function Qf(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Zf=new Map,t.forEach($f,e),Zf=null,Xf.call(e))}function $f(e,t){if(!(t.state.loading&4)){var n=Zf.get(e);if(n)var r=n.get(null);else{n=new Map,Zf.set(e,n);for(var i=e.querySelectorAll(`link[data-precedence],style[data-precedence]`),a=0;a<i.length;a++){var o=i[a];(o.nodeName===`LINK`||o.getAttribute(`media`)!==`not all`)&&(n.set(o.dataset.precedence,o),r=o)}r&&n.set(null,r)}i=t.instance,o=i.getAttribute(`data-precedence`),a=n.get(o)||r,a===r&&n.set(null,i),n.set(o,i),this.count++,r=Xf.bind(this),i.addEventListener(`load`,r),i.addEventListener(`error`,r),a?a.parentNode.insertBefore(i,a.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(i,e.firstChild)),t.state.loading|=4}}var ep={$$typeof:C,Provider:null,Consumer:null,_currentValue:ne,_currentValue2:ne,_threadCount:0};function tp(e,t,n,r,i,a,o,s,c){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=We(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=We(0),this.hiddenUpdates=We(null),this.identifierPrefix=r,this.onUncaughtError=i,this.onCaughtError=a,this.onRecoverableError=o,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=c,this.incompleteTransitions=new Map}function np(e,t,n,r,i,a,o,s,c,l,u,d){return e=new tp(e,t,n,o,c,l,u,d,s),t=1,!0===a&&(t|=24),a=ri(3,null,null,t),e.current=a,a.stateNode=e,t=ia(),t.refCount++,e.pooledCache=t,t.refCount++,a.memoizedState={element:r,isDehydrated:n,cache:t},Ia(a),e}function rp(e){return e?(e=ti,e):ti}function ip(e,t,n,r,i,a){i=rp(i),r.context===null?r.context=i:r.pendingContext=i,r=Ra(t),r.payload={element:n},a=a===void 0?null:a,a!==null&&(r.callback=a),n=za(e,r,t),n!==null&&(_u(n,e,t),Ba(n,e,t))}function ap(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function op(e,t){ap(e,t),(e=e.alternate)&&ap(e,t)}function sp(e){if(e.tag===13||e.tag===31){var t=Qr(e,67108864);t!==null&&_u(t,e,67108864),op(e,67108864)}}function cp(e){if(e.tag===13||e.tag===31){var t=hu();t=Xe(t);var n=Qr(e,t);n!==null&&_u(n,e,t),op(e,t)}}var lp=!0;function up(e,t,n,r){var i=P.T;P.T=null;var a=F.p;try{F.p=2,fp(e,t,n,r)}finally{F.p=a,P.T=i}}function dp(e,t,n,r){var i=P.T;P.T=null;var a=F.p;try{F.p=8,fp(e,t,n,r)}finally{F.p=a,P.T=i}}function fp(e,t,n,r){if(lp){var i=pp(r);if(i===null)Dd(e,t,r,mp,n),Tp(e,r);else if(Dp(i,e,t,n,r))r.stopPropagation();else if(Tp(e,r),t&4&&-1<wp.indexOf(e)){for(;i!==null;){var a=dt(i);if(a!==null)switch(a.tag){case 3:if(a=a.stateNode,a.current.memoizedState.isDehydrated){var o=ze(a.pendingLanes);if(o!==0){var s=a;for(s.pendingLanes|=2,s.entangledLanes|=2;o;){var c=1<<31-Me(o);s.entanglements[1]|=c,o&=~c}od(a),!(Rl&6)&&(ru=be()+500,sd(0,!1))}}break;case 31:case 13:s=Qr(a,2),s!==null&&_u(s,a,2),Su(),op(a,2)}if(a=pp(r),a===null&&Dd(e,t,r,mp,n),a===i)break;i=a}i!==null&&r.stopPropagation()}else Dd(e,t,r,null,n)}}function pp(e){return e=Xt(e),hp(e)}var mp=null;function hp(e){if(mp=null,e=ut(e),e!==null){var t=o(e);if(t===null)e=null;else{var n=t.tag;if(n===13){if(e=s(t),e!==null)return e;e=null}else if(n===31){if(e=c(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return mp=e,null}function gp(e){switch(e){case`beforetoggle`:case`cancel`:case`click`:case`close`:case`contextmenu`:case`copy`:case`cut`:case`auxclick`:case`dblclick`:case`dragend`:case`dragstart`:case`drop`:case`focusin`:case`focusout`:case`input`:case`invalid`:case`keydown`:case`keypress`:case`keyup`:case`mousedown`:case`mouseup`:case`paste`:case`pause`:case`play`:case`pointercancel`:case`pointerdown`:case`pointerup`:case`ratechange`:case`reset`:case`resize`:case`seeked`:case`submit`:case`toggle`:case`touchcancel`:case`touchend`:case`touchstart`:case`volumechange`:case`change`:case`selectionchange`:case`textInput`:case`compositionstart`:case`compositionend`:case`compositionupdate`:case`beforeblur`:case`afterblur`:case`beforeinput`:case`blur`:case`fullscreenchange`:case`focus`:case`hashchange`:case`popstate`:case`select`:case`selectstart`:return 2;case`drag`:case`dragenter`:case`dragexit`:case`dragleave`:case`dragover`:case`mousemove`:case`mouseout`:case`mouseover`:case`pointermove`:case`pointerout`:case`pointerover`:case`scroll`:case`touchmove`:case`wheel`:case`mouseenter`:case`mouseleave`:case`pointerenter`:case`pointerleave`:return 8;case`message`:switch(xe()){case Se:return 2;case Ce:return 8;case we:case Te:return 32;case Ee:return 268435456;default:return 32}default:return 32}}var _p=!1,vp=null,yp=null,bp=null,xp=new Map,Sp=new Map,Cp=[],wp=`mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset`.split(` `);function Tp(e,t){switch(e){case`focusin`:case`focusout`:vp=null;break;case`dragenter`:case`dragleave`:yp=null;break;case`mouseover`:case`mouseout`:bp=null;break;case`pointerover`:case`pointerout`:xp.delete(t.pointerId);break;case`gotpointercapture`:case`lostpointercapture`:Sp.delete(t.pointerId)}}function Ep(e,t,n,r,i,a){return e===null||e.nativeEvent!==a?(e={blockedOn:t,domEventName:n,eventSystemFlags:r,nativeEvent:a,targetContainers:[i]},t!==null&&(t=dt(t),t!==null&&sp(t)),e):(e.eventSystemFlags|=r,t=e.targetContainers,i!==null&&t.indexOf(i)===-1&&t.push(i),e)}function Dp(e,t,n,r,i){switch(t){case`focusin`:return vp=Ep(vp,e,t,n,r,i),!0;case`dragenter`:return yp=Ep(yp,e,t,n,r,i),!0;case`mouseover`:return bp=Ep(bp,e,t,n,r,i),!0;case`pointerover`:var a=i.pointerId;return xp.set(a,Ep(xp.get(a)||null,e,t,n,r,i)),!0;case`gotpointercapture`:return a=i.pointerId,Sp.set(a,Ep(Sp.get(a)||null,e,t,n,r,i)),!0}return!1}function Op(e){var t=ut(e.target);if(t!==null){var n=o(t);if(n!==null){if(t=n.tag,t===13){if(t=s(n),t!==null){e.blockedOn=t,$e(e.priority,function(){cp(n)});return}}else if(t===31){if(t=c(n),t!==null){e.blockedOn=t,$e(e.priority,function(){cp(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function kp(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=pp(e.nativeEvent);if(n===null){n=e.nativeEvent;var r=new n.constructor(n.type,n);Yt=r,n.target.dispatchEvent(r),Yt=null}else return t=dt(n),t!==null&&sp(t),e.blockedOn=n,!1;t.shift()}return!0}function Ap(e,t,n){kp(e)&&n.delete(t)}function jp(){_p=!1,vp!==null&&kp(vp)&&(vp=null),yp!==null&&kp(yp)&&(yp=null),bp!==null&&kp(bp)&&(bp=null),xp.forEach(Ap),Sp.forEach(Ap)}function Mp(e,n){e.blockedOn===n&&(e.blockedOn=null,_p||(_p=!0,t.unstable_scheduleCallback(t.unstable_NormalPriority,jp)))}var Np=null;function Pp(e){Np!==e&&(Np=e,t.unstable_scheduleCallback(t.unstable_NormalPriority,function(){Np===e&&(Np=null);for(var t=0;t<e.length;t+=3){var n=e[t],r=e[t+1],i=e[t+2];if(typeof r!=`function`){if(hp(r||n)===null)continue;break}var a=dt(n);a!==null&&(e.splice(t,3),t-=3,Ss(a,{pending:!0,data:i,method:n.method,action:r},r,i))}}))}function Fp(e){function t(t){return Mp(t,e)}vp!==null&&Mp(vp,e),yp!==null&&Mp(yp,e),bp!==null&&Mp(bp,e),xp.forEach(t),Sp.forEach(t);for(var n=0;n<Cp.length;n++){var r=Cp[n];r.blockedOn===e&&(r.blockedOn=null)}for(;0<Cp.length&&(n=Cp[0],n.blockedOn===null);)Op(n),n.blockedOn===null&&Cp.shift();if(n=(e.ownerDocument||e).$$reactFormReplay,n!=null)for(r=0;r<n.length;r+=3){var i=n[r],a=n[r+1],o=i[nt]||null;if(typeof a==`function`)o||Pp(n);else if(o){var s=null;if(a&&a.hasAttribute(`formAction`)){if(i=a,o=a[nt]||null)s=o.formAction;else if(hp(i)!==null)continue}else s=o.action;typeof s==`function`?n[r+1]=s:(n.splice(r,3),r-=3),Pp(n)}}}function Ip(){function e(e){e.canIntercept&&e.info===`react-transition`&&e.intercept({handler:function(){return new Promise(function(e){return i=e})},focusReset:`manual`,scroll:`manual`})}function t(){i!==null&&(i(),i=null),r||setTimeout(n,20)}function n(){if(!r&&!navigation.transition){var e=navigation.currentEntry;e&&e.url!=null&&navigation.navigate(e.url,{state:e.getState(),info:`react-transition`,history:`replace`})}}if(typeof navigation==`object`){var r=!1,i=null;return navigation.addEventListener(`navigate`,e),navigation.addEventListener(`navigatesuccess`,t),navigation.addEventListener(`navigateerror`,t),setTimeout(n,100),function(){r=!0,navigation.removeEventListener(`navigate`,e),navigation.removeEventListener(`navigatesuccess`,t),navigation.removeEventListener(`navigateerror`,t),i!==null&&(i(),i=null)}}}function Lp(e){this._internalRoot=e}Rp.prototype.render=Lp.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(i(409));var n=t.current;ip(n,hu(),e,t,null,null)},Rp.prototype.unmount=Lp.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;ip(e.current,2,null,e,null,null),Su(),t[rt]=null}};function Rp(e){this._internalRoot=e}Rp.prototype.unstable_scheduleHydration=function(e){if(e){var t=Qe();e={blockedOn:null,target:e,priority:t};for(var n=0;n<Cp.length&&t!==0&&t<Cp[n].priority;n++);Cp.splice(n,0,e),n===0&&Op(e)}};var zp=n.version;if(zp!==`19.2.7`)throw Error(i(527,zp,`19.2.7`));F.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render==`function`?Error(i(188)):(e=Object.keys(e).join(`,`),Error(i(268,e)));return e=u(t),e=e===null?null:f(e),e=e===null?null:e.stateNode,e};var Bp={bundleType:0,version:`19.2.7`,rendererPackageName:`react-dom`,currentDispatcherRef:P,reconcilerVersion:`19.2.7`};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<`u`){var Vp=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Vp.isDisabled&&Vp.supportsFiber)try{ke=Vp.inject(Bp),Ae=Vp}catch{}}e.createRoot=function(e,t){if(!a(e))throw Error(i(299));var n=!1,r=``,o=Gs,s=Ks,c=qs;return t!=null&&(!0===t.unstable_strictMode&&(n=!0),t.identifierPrefix!==void 0&&(r=t.identifierPrefix),t.onUncaughtError!==void 0&&(o=t.onUncaughtError),t.onCaughtError!==void 0&&(s=t.onCaughtError),t.onRecoverableError!==void 0&&(c=t.onRecoverableError)),t=np(e,1,!1,null,null,n,r,null,o,s,c,Ip),e[rt]=t.current,Td(e),new Lp(t)}})),_=o(((e,t)=>{function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>`u`||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!=`function`))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(e){console.error(e)}}n(),t.exports=g()})),v=l(d(),1),y=l(_(),1);function b(e){if(Array.isArray(e))return e;let t=e?.models;return Array.isArray(t)?t:[]}function x(e){if(Array.isArray(e))return e;let t=e?.nodes;return Array.isArray(t)?t:[]}function S(){return j(`/health`)}function C(){return j(`/health/controller`)}async function w(){let[e,t,n]=await Promise.all([S(),j(`/models`),j(`/nodes/models`)]);return{health:e,localModels:b(t),nodes:x(n)}}var T=`/lm-api/v1`,E=()=>``;function D(e){E=e}function O(e,t=!1){let n=E(),r={Accept:t?`text/event-stream`:`application/json`};return n&&(r[`X-UI-Session`]=n),e.body!==void 0&&(r[`Content-Type`]=`application/json`),{...r,...e.headers||{}}}async function k(e){if(!e.ok){let t=await e.text();throw Error(`${e.status} ${e.statusText}: ${t}`)}}async function A(e,t={}){let n=await fetch(T+e,{method:t.method||`GET`,...t.body===void 0?{}:{body:JSON.stringify(t.body)},headers:O(t),signal:t.signal});return await k(n),n.json()}async function ee(e,t={}){let n=await fetch(e,{method:t.method||`GET`,...t.body===void 0?{}:{body:JSON.stringify(t.body)},headers:O(t),signal:t.signal});return await k(n),n.json()}function j(e,t={}){return A(e,{...t,method:`GET`})}function M(e,t,n={}){return A(e,{...n,method:`POST`,body:t})}function te(e,t,n={}){return ee(e,{...n,method:`POST`,body:t})}function N(e,t,n={}){return A(e,{...n,method:`PUT`,body:t})}function P(e,t,n={}){return A(e,{...n,method:`PATCH`,body:t})}function F(e,t={}){return A(e,{...t,method:`DELETE`})}async function ne(e,t={}){let n=await fetch(T+e,{method:t.method||`GET`,...t.body===void 0?{}:{body:JSON.stringify(t.body)},headers:O(t,!0),signal:t.signal});if(await k(n),!n.body)throw Error(`Response did not include a readable stream`);return n.body.getReader()}function re(e){return M(`/auth/login`,e)}function ie(){return M(`/auth/logout`)}function I(){return j(`/auth/me`)}function ae(){return j(`/auth/keys`)}function L(e){return M(`/auth/keys`,e)}function oe(e){return M(`/auth/keys/${encodeURIComponent(e)}/revoke`)}function se(){return j(`/setup/status`)}function ce(e){return M(`/setup/bootstrap-admin`,e)}function le(){return j(`/setup/current-config`)}var ue=o((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.fragment`);function r(e,n,r){var i=null;if(r!==void 0&&(i=``+r),n.key!==void 0&&(i=``+n.key),`key`in n)for(var a in r={},n)a!==`key`&&(r[a]=n[a]);else r=n;return n=r.ref,{$$typeof:t,type:e,key:i,ref:n===void 0?null:n,props:r}}e.Fragment=n,e.jsx=r,e.jsxs=r})),R=o(((e,t)=>{t.exports=ue()}))();function z({variant:e=`ghost`,size:t,className:n,...r}){return(0,R.jsx)(`button`,{className:[`btn`,`btn-${e}`,t===`md`?`btn-md`:``,n].filter(Boolean).join(` `),...r})}function de({message:e}){return(0,R.jsx)(`p`,{className:`empty`,children:e})}function fe({columns:e,rows:t,emptyMessage:n,getRowKey:r}){return t.length===0?(0,R.jsx)(de,{message:n}):(0,R.jsx)(`div`,{className:`table-wrap`,children:(0,R.jsxs)(`table`,{className:`data-table`,children:[(0,R.jsx)(`thead`,{children:(0,R.jsx)(`tr`,{children:e.map(e=>(0,R.jsx)(`th`,{children:e.header},e.key))})}),(0,R.jsx)(`tbody`,{children:t.map((t,n)=>(0,R.jsx)(`tr`,{children:e.map(e=>(0,R.jsx)(`td`,{children:e.render(t)},e.key))},r(t,n)))})]})})}function pe({message:e}){return e?(0,R.jsx)(`p`,{className:`error-text`,role:`alert`,children:e}):null}function B({label:e,children:t,hint:n}){return(0,R.jsxs)(`label`,{className:`form-field`,children:[(0,R.jsx)(`span`,{className:`label`,children:e}),t,n?(0,R.jsx)(`small`,{className:`muted`,children:n}):null]})}function me({title:e,open:t,onClose:n,children:r}){return t?(0,R.jsx)(`div`,{className:`modal-backdrop`,role:`presentation`,children:(0,R.jsxs)(`section`,{className:`modal-panel`,role:`dialog`,"aria-modal":`true`,"aria-label":e,children:[(0,R.jsxs)(`div`,{className:`panel-title`,children:[(0,R.jsx)(`h2`,{children:e}),(0,R.jsx)(z,{type:`button`,onClick:n,"aria-label":`Close ${e}`,children:`Close`})]}),r]})}):null}function V({eyebrow:e,title:t,actions:n,children:r,className:i=``}){return(0,R.jsxs)(`section`,{className:`panel ${i}`.trim(),children:[t||e||n?(0,R.jsxs)(`div`,{className:`panel-title`,children:[(0,R.jsxs)(`div`,{children:[e?(0,R.jsx)(`span`,{className:`eyebrow`,children:e}):null,t?(0,R.jsx)(`h3`,{children:t}):null]}),n?(0,R.jsx)(`div`,{className:`panel-actions`,children:n}):null]}):null,r]})}function H({tone:e=`muted`,children:t}){return(0,R.jsx)(`span`,{className:`status-badge status-badge-${e}`,children:t})}var he=`lm_ui_token`,ge=(0,v.createContext)(null);function _e({children:e}){let[t,n]=(0,v.useState)(()=>localStorage.getItem(`lm_ui_token`)||``),[r,i]=(0,v.useState)(``),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(()=>!localStorage.getItem(he)),[l,u]=(0,v.useState)(null),[d,f]=(0,v.useState)(null),[p,m]=(0,v.useState)(!0);(0,v.useLayoutEffect)(()=>{D(()=>localStorage.getItem(`lm_ui_token`)||``)},[]),(0,v.useEffect)(()=>{let e=!0;return se().then(t=>{e&&(u(!!t.auth_enabled),f(!!t.auth_bootstrap_required))}).catch(()=>{e&&(u(!1),f(!1))}).finally(()=>{e&&m(!1)}),()=>{e=!1}},[]),(0,v.useEffect)(()=>{if(!t){c(!0);return}if(r){c(!0);return}c(!1),I().then(e=>{i(e.username),o(e.role||`operator`),c(!0)}).catch(()=>{localStorage.removeItem(he),n(``),i(``),o(``),c(!0)})},[t,r]);async function h(e,t){g(await re({username:e,api_key:t}))}function g(e){localStorage.setItem(he,e.token),n(e.token),i(e.username),o(e.role),c(!0)}async function _(){try{await ie()}finally{localStorage.removeItem(he),n(``),i(``),o(``),c(!0)}}let y=(0,v.useMemo)(()=>({authToken:t,authUser:r,authRole:a,authChecked:s,isAuthenticated:!!t,authEnabled:l,bootstrapRequired:d,setupStatusPending:p,loginWithKey:h,acceptSession:g,logoutSession:_}),[t,r,a,s,l,d,p]);return(0,R.jsx)(ge.Provider,{value:y,children:e})}function U(){let e=(0,v.useContext)(ge);if(!e)throw Error(`useAuthSession must be used within AuthSessionProvider`);return e}function ve(){let{authUser:e,authRole:t,isAuthenticated:n,loginWithKey:r,logoutSession:i}=U(),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(``);async function d(e){e.preventDefault(),u(``);try{await r(a,s),c(``)}catch(e){u(e instanceof Error?e.message:`Login failed`)}}return(0,R.jsxs)(`form`,{className:`auth-form`,onSubmit:d,children:[(0,R.jsx)(`input`,{value:a,onChange:e=>o(e.target.value),type:`text`,placeholder:`username`}),(0,R.jsx)(`input`,{value:s,onChange:e=>c(e.target.value),type:`password`,placeholder:`api key`}),(0,R.jsx)(z,{type:`submit`,children:`Login`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void i(),disabled:!n,children:`Logout`}),(0,R.jsx)(`span`,{className:`muted text-xs font-bold`,children:e?`${e} (${t||`operator`})`:`Not logged in`}),l?(0,R.jsx)(`span`,{className:`error-text`,role:`alert`,children:l}):null]})}var ye={color:void 0,size:void 0,className:void 0,style:void 0,attr:void 0},be=v.createContext&&v.createContext(ye),xe=[`attr`,`size`,`title`];function Se(e,t){if(e==null)return{};var n,r,i=Ce(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)===-1&&{}.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}function Ce(e,t){if(e==null)return{};var n={};for(var r in e)if({}.hasOwnProperty.call(e,r)){if(t.indexOf(r)!==-1)continue;n[r]=e[r]}return n}function we(){return we=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)({}).hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},we.apply(null,arguments)}function Te(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),n.push.apply(n,r)}return n}function Ee(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:arguments[t];t%2?Te(Object(n),!0).forEach(function(t){De(e,t,n[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):Te(Object(n)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))})}return e}function De(e,t,n){return(t=Oe(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function Oe(e){var t=ke(e,`string`);return typeof t==`symbol`?t:t+``}function ke(e,t){if(typeof e!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(typeof r!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function Ae(e){return e&&e.map((e,t)=>v.createElement(e.tag,Ee({key:t},e.attr),Ae(e.child)))}function je(e){return t=>v.createElement(Me,we({attr:Ee({},e.attr)},t),Ae(e.child))}function Me(e){var t=t=>{var{attr:n,size:r,title:i}=e,a=Se(e,xe),o=r||t.size||`1em`,s;return t.className&&(s=t.className),e.className&&(s=(s?s+` `:``)+e.className),v.createElement(`svg`,we({stroke:`currentColor`,fill:`currentColor`,strokeWidth:`0`},t.attr,n,a,{className:s,style:Ee(Ee({color:e.color||t.color},t.style),e.style),height:o,width:o,xmlns:`http://www.w3.org/2000/svg`}),i&&v.createElement(`title`,null,i),e.children)};return be===void 0?t(ye):v.createElement(be.Consumer,null,e=>t(e))}function Ne(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M432 32H80a64.07 64.07 0 0 0-64 64v320a64.07 64.07 0 0 0 64 64h352a64.07 64.07 0 0 0 64-64V96a64.07 64.07 0 0 0-64-64zM96 256a16 16 0 0 1-10-28.49L150.39 176 86 124.49a16 16 0 1 1 20-25l80 64a16 16 0 0 1 0 25l-80 64A16 16 0 0 1 96 256zm160 0h-64a16 16 0 0 1 0-32h64a16 16 0 0 1 0 32z`},child:[]}]})(e)}function Pe(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M256 118a22 22 0 0 1-22-22V48a22 22 0 0 1 44 0v48a22 22 0 0 1-22 22zm0 368a22 22 0 0 1-22-22v-48a22 22 0 0 1 44 0v48a22 22 0 0 1-22 22zm113.14-321.14a22 22 0 0 1-15.56-37.55l33.94-33.94a22 22 0 0 1 31.11 31.11l-33.94 33.94a21.93 21.93 0 0 1-15.55 6.44zM108.92 425.08a22 22 0 0 1-15.55-37.56l33.94-33.94a22 22 0 1 1 31.11 31.11l-33.94 33.94a21.94 21.94 0 0 1-15.56 6.45zM464 278h-48a22 22 0 0 1 0-44h48a22 22 0 0 1 0 44zm-368 0H48a22 22 0 0 1 0-44h48a22 22 0 0 1 0 44zm307.08 147.08a21.94 21.94 0 0 1-15.56-6.45l-33.94-33.94a22 22 0 0 1 31.11-31.11l33.94 33.94a22 22 0 0 1-15.55 37.56zM142.86 164.86a21.89 21.89 0 0 1-15.55-6.44l-33.94-33.94a22 22 0 0 1 31.11-31.11l33.94 33.94a22 22 0 0 1-15.56 37.55zM256 358a102 102 0 1 1 102-102 102.12 102.12 0 0 1-102 102z`},child:[]}]})(e)}function Fe(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M392 432H120a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h272a40 40 0 0 1 40 40v272a40 40 0 0 1-40 40z`},child:[]}]})(e)}function Ie(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M104 496H72a24 24 0 0 1-24-24V328a24 24 0 0 1 24-24h32a24 24 0 0 1 24 24v144a24 24 0 0 1-24 24zm224 0h-32a24 24 0 0 1-24-24V232a24 24 0 0 1 24-24h32a24 24 0 0 1 24 24v240a24 24 0 0 1-24 24zm112 0h-32a24 24 0 0 1-24-24V120a24 24 0 0 1 24-24h32a24 24 0 0 1 24 24v352a24 24 0 0 1-24 24zm-224 0h-32a24 24 0 0 1-24-24V40a24 24 0 0 1 24-24h32a24 24 0 0 1 24 24v432a24 24 0 0 1-24 24z`},child:[]}]})(e)}function Le(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M394 480a16 16 0 0 1-9.39-3L256 383.76 127.39 477a16 16 0 0 1-24.55-18.08L153 310.35 23 221.2a16 16 0 0 1 9-29.2h160.38l48.4-148.95a16 16 0 0 1 30.44 0l48.4 149H480a16 16 0 0 1 9.05 29.2L359 310.35l50.13 148.53A16 16 0 0 1 394 480z`},child:[]}]})(e)}function Re(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`m476.59 227.05-.16-.07L49.35 49.84A23.56 23.56 0 0 0 27.14 52 24.65 24.65 0 0 0 16 72.59v113.29a24 24 0 0 0 19.52 23.57l232.93 43.07a4 4 0 0 1 0 7.86L35.53 303.45A24 24 0 0 0 16 327v113.31A23.57 23.57 0 0 0 26.59 460a23.94 23.94 0 0 0 13.22 4 24.55 24.55 0 0 0 9.52-1.93L476.4 285.94l.19-.09a32 32 0 0 0 0-58.8z`},child:[]}]})(e)}function ze(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{fill:`none`,strokeLinecap:`square`,strokeMiterlimit:`10`,strokeWidth:`32`,d:`M320 146s24.36-12-64-12a160 160 0 1 0 160 160`},child:[]},{tag:`path`,attr:{fill:`none`,strokeLinecap:`square`,strokeMiterlimit:`10`,strokeWidth:`32`,d:`m256 58 80 80-80 80`},child:[]}]})(e)}function Be(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`m96 448 320-192L96 64v384z`},child:[]}]})(e)}function Ve(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M264 480A232 232 0 0 1 32 248c0-94 54-178.28 137.61-214.67a16 16 0 0 1 21.06 21.06C181.07 76.43 176 104.66 176 136c0 110.28 89.72 200 200 200 31.34 0 59.57-5.07 81.61-14.67a16 16 0 0 1 21.06 21.06C442.28 426 358 480 264 480z`},child:[]}]})(e)}function He(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M261.56 101.28a8 8 0 0 0-11.06 0L66.4 277.15a8 8 0 0 0-2.47 5.79L63.9 448a32 32 0 0 0 32 32H192a16 16 0 0 0 16-16V328a8 8 0 0 1 8-8h80a8 8 0 0 1 8 8v136a16 16 0 0 0 16 16h96.06a32 32 0 0 0 32-32V282.94a8 8 0 0 0-2.47-5.79z`},child:[]},{tag:`path`,attr:{d:`m490.91 244.15-74.8-71.56V64a16 16 0 0 0-16-16h-48a16 16 0 0 0-16 16v32l-57.92-55.38C272.77 35.14 264.71 32 256 32c-8.68 0-16.72 3.14-22.14 8.63l-212.7 203.5c-6.22 6-7 15.87-1.34 22.37A16 16 0 0 0 43 267.56L250.5 69.28a8 8 0 0 1 11.06 0l207.52 198.28a16 16 0 0 0 22.59-.44c6.14-6.36 5.63-16.86-.76-22.97z`},child:[]}]})(e)}function Ue(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0 1 24.5 20.58z`},child:[]}]})(e)}function We(e){return je({tag:`svg`,attr:{viewBox:`0 0 512 512`},child:[{tag:`path`,attr:{d:`M60.44 389.17c0 .07 0 .2-.08.38.03-.12.05-.25.08-.38zM439.9 405.6a26.77 26.77 0 0 1-9.59-2l-56.78-20.13-.42-.17a9.88 9.88 0 0 0-3.91-.76 10.32 10.32 0 0 0-3.62.66c-1.38.52-13.81 5.19-26.85 8.77-7.07 1.94-31.68 8.27-51.43 8.27-50.48 0-97.68-19.4-132.89-54.63A183.38 183.38 0 0 1 100.3 215.1a175.9 175.9 0 0 1 4.06-37.58c8.79-40.62 32.07-77.57 65.55-104A194.76 194.76 0 0 1 290.3 32c52.21 0 100.86 20 137 56.18 34.16 34.27 52.88 79.33 52.73 126.87a177.86 177.86 0 0 1-30.3 99.15l-.19.28-.74 1c-.17.23-.34.45-.5.68l-.15.27a21.63 21.63 0 0 0-1.08 2.09l15.74 55.94a26.42 26.42 0 0 1 1.12 7.11 24 24 0 0 1-24.03 24.03z`},child:[]},{tag:`path`,attr:{d:`M299.87 425.39a15.74 15.74 0 0 0-10.29-8.1c-5.78-1.53-12.52-1.27-17.67-1.65a201.78 201.78 0 0 1-128.82-58.75A199.21 199.21 0 0 1 86.4 244.16C85 234.42 85 232 85 232a16 16 0 0 0-28-10.58s-7.88 8.58-11.6 17.19a162.09 162.09 0 0 0 11 150.06C59 393 59 395 58.42 399.5c-2.73 14.11-7.51 39-10 51.91a24 24 0 0 0 8 22.92l.46.39A24.34 24.34 0 0 0 72 480a23.42 23.42 0 0 0 9-1.79l53.51-20.65a8.05 8.05 0 0 1 5.72 0c21.07 7.84 43 12 63.78 12a176 176 0 0 0 74.91-16.66c5.46-2.56 14-5.34 19-11.12a15 15 0 0 0 1.95-16.39z`},child:[]}]})(e)}var Ge=`llama-pack-theme`,Ke=(0,v.createContext)(null);function qe(e){return e===`light`||e===`dark`}function Je(){return typeof window>`u`||typeof window.matchMedia!=`function`?`light`:window.matchMedia(`(prefers-color-scheme: dark)`).matches?`dark`:`light`}function Ye(){let e=localStorage.getItem(Ge);return qe(e)?e:Je()}function Xe({children:e}){let[t,n]=(0,v.useState)(Ye);(0,v.useEffect)(()=>{document.documentElement.dataset.theme=t,localStorage.setItem(Ge,t)},[t]);function r(e){n(e)}function i(){n(e=>e===`dark`?`light`:`dark`)}let a=(0,v.useMemo)(()=>({theme:t,setTheme:r,toggleTheme:i}),[t]);return(0,R.jsx)(Ke.Provider,{value:a,children:e})}function Ze(){let e=(0,v.useContext)(Ke);if(!e)throw Error(`useTheme must be used within ThemeProvider`);return e}function Qe(){let{theme:e,toggleTheme:t}=Ze();return(0,R.jsx)(`button`,{"aria-label":`Switch to ${e===`dark`?`light`:`dark`} mode`,className:`theme-toggle`,type:`button`,onClick:t,children:(0,R.jsx)(`span`,{"aria-hidden":`true`,children:e===`dark`?(0,R.jsx)(Ve,{}):(0,R.jsx)(Pe,{})})})}var $e=`modulepreload`,et=function(e){return`/ui/`+e},tt={},nt=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}r=o(t.map(t=>{if(t=et(t,n),t in tt)return;tt[t]=!0;let r=t.endsWith(`.css`),i=r?`[rel="stylesheet"]`:``;if(n)for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}else if(document.querySelector(`link[href="${t}"]${i}`))return;let o=document.createElement(`link`);if(o.rel=r?`stylesheet`:$e,r||(o.as=`script`),o.crossOrigin=``,o.href=t,a&&o.setAttribute(`nonce`,a),document.head.appendChild(o),r)return new Promise((e,n)=>{o.addEventListener(`load`,e),o.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},rt=`popstate`;function it(e){return typeof e==`object`&&!!e&&`pathname`in e&&`search`in e&&`hash`in e&&`state`in e&&`key`in e}function at(e={}){function t(e,t){let n=t.state?.masked,{pathname:r,search:i,hash:a}=n||e.location;return ut(``,{pathname:r,search:i,hash:a},t.state&&t.state.usr||null,t.state&&t.state.key||`default`,n?{pathname:e.location.pathname,search:e.location.search,hash:e.location.hash}:void 0)}function n(e,t){return typeof t==`string`?t:dt(t)}return pt(t,n,null,e)}function ot(e,t){if(e===!1||e==null)throw Error(t)}function st(e,t){if(!e){typeof console<`u`&&console.warn(t);try{throw Error(t)}catch{}}}function ct(){return Math.random().toString(36).substring(2,10)}function lt(e,t){return{usr:e.state,key:e.key,idx:t,masked:e.mask?{pathname:e.pathname,search:e.search,hash:e.hash}:void 0}}function ut(e,t,n=null,r,i){return{pathname:typeof e==`string`?e:e.pathname,search:``,hash:``,...typeof t==`string`?ft(t):t,state:n,key:t&&t.key||r||ct(),mask:i}}function dt({pathname:e=`/`,search:t=``,hash:n=``}){return t&&t!==`?`&&(e+=t.charAt(0)===`?`?t:`?`+t),n&&n!==`#`&&(e+=n.charAt(0)===`#`?n:`#`+n),e}function ft(e){let t={};if(e){let n=e.indexOf(`#`);n>=0&&(t.hash=e.substring(n),e=e.substring(0,n));let r=e.indexOf(`?`);r>=0&&(t.search=e.substring(r),e=e.substring(0,r)),e&&(t.pathname=e)}return t}function pt(e,t,n,r={}){let{window:i=document.defaultView,v5Compat:a=!1}=r,o=i.history,s=`POP`,c=null,l=u();l??(l=0,o.replaceState({...o.state,idx:l},``));function u(){return(o.state||{idx:null}).idx}function d(){s=`POP`;let e=u(),t=e==null?null:e-l;l=e,c&&c({action:s,location:h.location,delta:t})}function f(e,t){s=`PUSH`;let r=it(e)?e:ut(h.location,e,t);n&&n(r,e),l=u()+1;let d=lt(r,l),f=h.createHref(r.mask||r);try{o.pushState(d,``,f)}catch(e){if(e instanceof DOMException&&e.name===`DataCloneError`)throw e;i.location.assign(f)}a&&c&&c({action:s,location:h.location,delta:1})}function p(e,t){s=`REPLACE`;let r=it(e)?e:ut(h.location,e,t);n&&n(r,e),l=u();let i=lt(r,l),d=h.createHref(r.mask||r);o.replaceState(i,``,d),a&&c&&c({action:s,location:h.location,delta:0})}function m(e){return mt(i,e)}let h={get action(){return s},get location(){return e(i,o)},listen(e){if(c)throw Error(`A history only accepts one active listener`);return i.addEventListener(rt,d),c=e,()=>{i.removeEventListener(rt,d),c=null}},createHref(e){return t(i,e)},createURL:m,encodeLocation(e){let t=m(e);return{pathname:t.pathname,search:t.search,hash:t.hash}},push:f,replace:p,go(e){return o.go(e)}};return h}function mt(e,t,n=!1){let r=`http://localhost`;e&&(r=e.location.origin===`null`?e.location.href:e.location.origin),ot(r,`No window.location.(origin|href) available to create URL`);let i=typeof t==`string`?t:dt(t);return i=i.replace(/ $/,`%20`),!n&&i.startsWith(`//`)&&(i=r+i),new URL(i,r)}function ht(e,t,n=`/`){return gt(e,t,n,!1)}function gt(e,t,n,r,i){let a=Ft((typeof t==`string`?ft(t):t).pathname||`/`,n);if(a==null)return null;let o=i??vt(e),s=null,c=Pt(a);for(let e=0;s==null&&e<o.length;++e)s=jt(o[e],c,r);return s}function _t(e,t){let{route:n,pathname:r,params:i}=e;return{id:n.id,pathname:r,params:i,data:t[n.id],loaderData:t[n.id],handle:n.handle}}function vt(e){let t=yt(e);return xt(t),t}function yt(e,t=[],n=[],r=``,i=!1){let a=(e,a,o=i,s)=>{let c={relativePath:s===void 0?e.path||``:s,caseSensitive:e.caseSensitive===!0,childrenIndex:a,route:e};if(c.relativePath.startsWith(`/`)){if(!c.relativePath.startsWith(r)&&o)return;ot(c.relativePath.startsWith(r),`Absolute route path "${c.relativePath}" nested under path "${r}" is not valid. An absolute child route path must start with the combined path of all its parent routes.`),c.relativePath=c.relativePath.slice(r.length)}let l=Wt([r,c.relativePath]),u=n.concat(c);e.children&&e.children.length>0&&(ot(e.index!==!0,`Index routes must not have child routes. Please remove all child routes from route path "${l}".`),yt(e.children,t,u,l,o)),!(e.path==null&&!e.index)&&t.push({path:l,score:kt(l,e.index),routesMeta:u})};return e.forEach((e,t)=>{if(e.path===``||!e.path?.includes(`?`))a(e,t);else for(let n of bt(e.path))a(e,t,!0,n)}),t}function bt(e){let t=e.split(`/`);if(t.length===0)return[];let[n,...r]=t,i=n.endsWith(`?`),a=n.replace(/\?$/,``);if(r.length===0)return i?[a,``]:[a];let o=bt(r.join(`/`)),s=[];return s.push(...o.map(e=>e===``?a:[a,e].join(`/`))),i&&s.push(...o),s.map(t=>e.startsWith(`/`)&&t===``?`/`:t)}function xt(e){e.sort((e,t)=>e.score===t.score?At(e.routesMeta.map(e=>e.childrenIndex),t.routesMeta.map(e=>e.childrenIndex)):t.score-e.score)}var St=/^:[\w-]+$/,Ct=3,wt=2,Tt=1,Et=10,Dt=-2,Ot=e=>e===`*`;function kt(e,t){let n=e.split(`/`),r=n.length;return n.some(Ot)&&(r+=Dt),t&&(r+=wt),n.filter(e=>!Ot(e)).reduce((e,t)=>e+(St.test(t)?Ct:t===``?Tt:Et),r)}function At(e,t){return e.length===t.length&&e.slice(0,-1).every((e,n)=>e===t[n])?e[e.length-1]-t[t.length-1]:0}function jt(e,t,n=!1){let{routesMeta:r}=e,i={},a=`/`,o=[];for(let e=0;e<r.length;++e){let s=r[e],c=e===r.length-1,l=a===`/`?t:t.slice(a.length)||`/`,u=Mt({path:s.relativePath,caseSensitive:s.caseSensitive,end:c},l),d=s.route;if(!u&&c&&n&&!r[r.length-1].route.index&&(u=Mt({path:s.relativePath,caseSensitive:s.caseSensitive,end:!1},l)),!u)return null;Object.assign(i,u.params),o.push({params:i,pathname:Wt([a,u.pathname]),pathnameBase:Kt(Wt([a,u.pathnameBase])),route:d}),u.pathnameBase!==`/`&&(a=Wt([a,u.pathnameBase]))}return o}function Mt(e,t){typeof e==`string`&&(e={path:e,caseSensitive:!1,end:!0});let[n,r]=Nt(e.path,e.caseSensitive,e.end),i=t.match(n);if(!i)return null;let a=i[0],o=a.replace(/(.)\/+$/,`$1`),s=i.slice(1);return{params:r.reduce((e,{paramName:t,isOptional:n},r)=>{if(t===`*`){let e=s[r]||``;o=a.slice(0,a.length-e.length).replace(/(.)\/+$/,`$1`)}let i=s[r];return n&&!i?e[t]=void 0:e[t]=(i||``).replace(/%2F/g,`/`),e},{}),pathname:a,pathnameBase:o,pattern:e}}function Nt(e,t=!1,n=!0){st(e===`*`||!e.endsWith(`*`)||e.endsWith(`/*`),`Route path "${e}" will be treated as if it were "${e.replace(/\*$/,`/*`)}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${e.replace(/\*$/,`/*`)}".`);let r=[],i=`^`+e.replace(/\/*\*?$/,``).replace(/^\/*/,`/`).replace(/[\\.*+^${}|()[\]]/g,`\\$&`).replace(/\/:([\w-]+)(\?)?/g,(e,t,n,i,a)=>{if(r.push({paramName:t,isOptional:n!=null}),n){let t=a.charAt(i+e.length);return t&&t!==`/`?`/([^\\/]*)`:`(?:/([^\\/]*))?`}return`/([^\\/]+)`}).replace(/\/([\w-]+)\?(\/|$)/g,`(/$1)?$2`);return e.endsWith(`*`)?(r.push({paramName:`*`}),i+=e===`*`||e===`/*`?`(.*)$`:`(?:\\/(.+)|\\/*)$`):n?i+=`\\/*$`:e!==``&&e!==`/`&&(i+=`(?:(?=\\/|$))`),[new RegExp(i,t?void 0:`i`),r]}function Pt(e){try{return e.split(`/`).map(e=>decodeURIComponent(e).replace(/\//g,`%2F`)).join(`/`)}catch(t){return st(!1,`The URL path "${e}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${t}).`),e}}function Ft(e,t){if(t===`/`)return e;if(!e.toLowerCase().startsWith(t.toLowerCase()))return null;let n=t.endsWith(`/`)?t.length-1:t.length,r=e.charAt(n);return r&&r!==`/`?null:e.slice(n)||`/`}var It=/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;function Lt(e,t=`/`){let{pathname:n,search:r=``,hash:i=``}=typeof e==`string`?ft(e):e,a;return n?(n=Ut(n),a=n.startsWith(`/`)?Rt(n.substring(1),`/`):Rt(n,t)):a=t,{pathname:a,search:qt(r),hash:Jt(i)}}function Rt(e,t){let n=Gt(t).split(`/`);return e.split(`/`).forEach(e=>{e===`..`?n.length>1&&n.pop():e!==`.`&&n.push(e)}),n.length>1?n.join(`/`):`/`}function zt(e,t,n,r){return`Cannot include a '${e}' character in a manually specified \`to.${t}\` field [${JSON.stringify(r)}].  Please separate it out to the \`to.${n}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`}function Bt(e){return e.filter((e,t)=>t===0||e.route.path&&e.route.path.length>0)}function Vt(e){let t=Bt(e);return t.map((e,n)=>n===t.length-1?e.pathname:e.pathnameBase)}function Ht(e,t,n,r=!1){let i;typeof e==`string`?i=ft(e):(i={...e},ot(!i.pathname||!i.pathname.includes(`?`),zt(`?`,`pathname`,`search`,i)),ot(!i.pathname||!i.pathname.includes(`#`),zt(`#`,`pathname`,`hash`,i)),ot(!i.search||!i.search.includes(`#`),zt(`#`,`search`,`hash`,i)));let a=e===``||i.pathname===``,o=a?`/`:i.pathname,s;if(o==null)s=n;else{let e=t.length-1;if(!r&&o.startsWith(`..`)){let t=o.split(`/`);for(;t[0]===`..`;)t.shift(),--e;i.pathname=t.join(`/`)}s=e>=0?t[e]:`/`}let c=Lt(i,s),l=o&&o!==`/`&&o.endsWith(`/`),u=(a||o===`.`)&&n.endsWith(`/`);return!c.pathname.endsWith(`/`)&&(l||u)&&(c.pathname+=`/`),c}var Ut=e=>e.replace(/\/\/+/g,`/`),Wt=e=>Ut(e.join(`/`)),Gt=e=>e.replace(/\/+$/,``),Kt=e=>Gt(e).replace(/^\/*/,`/`),qt=e=>!e||e===`?`?``:e.startsWith(`?`)?e:`?`+e,Jt=e=>!e||e===`#`?``:e.startsWith(`#`)?e:`#`+e,Yt=class{constructor(e,t,n,r=!1){this.status=e,this.statusText=t||``,this.internal=r,n instanceof Error?(this.data=n.toString(),this.error=n):this.data=n}};function Xt(e){return e!=null&&typeof e.status==`number`&&typeof e.statusText==`string`&&typeof e.internal==`boolean`&&`data`in e}function Zt(e){return Wt(e.map(e=>e.route.path).filter(Boolean))||`/`}var Qt=typeof window<`u`&&window.document!==void 0&&window.document.createElement!==void 0;function $t(e,t){let n=e;if(typeof n!=`string`||!It.test(n))return{absoluteURL:void 0,isExternal:!1,to:n};let r=n,i=!1;if(Qt)try{let e=new URL(window.location.href),r=n.startsWith(`//`)?new URL(e.protocol+n):new URL(n),a=Ft(r.pathname,t);r.origin===e.origin&&a!=null?n=a+r.search+r.hash:i=!0}catch{st(!1,`<Link to="${n}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`)}return{absoluteURL:r,isExternal:i,to:n}}Object.getOwnPropertyNames(Object.prototype).sort().join(`\0`);var en=[`POST`,`PUT`,`PATCH`,`DELETE`];new Set(en);var tn=[`GET`,...en];new Set(tn);var nn=v.createContext(null);nn.displayName=`DataRouter`;var rn=v.createContext(null);rn.displayName=`DataRouterState`;var an=v.createContext(!1);function on(){return v.useContext(an)}var sn=v.createContext({isTransitioning:!1});sn.displayName=`ViewTransition`;var cn=v.createContext(new Map);cn.displayName=`Fetchers`;var ln=v.createContext(null);ln.displayName=`Await`;var un=v.createContext(null);un.displayName=`Navigation`;var dn=v.createContext(null);dn.displayName=`Location`;var fn=v.createContext({outlet:null,matches:[],isDataRoute:!1});fn.displayName=`Route`;var pn=v.createContext(null);pn.displayName=`RouteError`;var mn=`REACT_ROUTER_ERROR`,hn=`REDIRECT`,gn=`ROUTE_ERROR_RESPONSE`;function _n(e){if(e.startsWith(`${mn}:${hn}:{`))try{let t=JSON.parse(e.slice(28));if(typeof t==`object`&&t&&typeof t.status==`number`&&typeof t.statusText==`string`&&typeof t.location==`string`&&typeof t.reloadDocument==`boolean`&&typeof t.replace==`boolean`)return t}catch{}}function vn(e){if(e.startsWith(`${mn}:${gn}:{`))try{let t=JSON.parse(e.slice(40));if(typeof t==`object`&&t&&typeof t.status==`number`&&typeof t.statusText==`string`)return new Yt(t.status,t.statusText,t.data)}catch{}}function yn(e,{relative:t}={}){ot(bn(),`useHref() may be used only in the context of a <Router> component.`);let{basename:n,navigator:r}=v.useContext(un),{hash:i,pathname:a,search:o}=kn(e,{relative:t}),s=a;return n!==`/`&&(s=a===`/`?n:Wt([n,a])),r.createHref({pathname:s,search:o,hash:i})}function bn(){return v.useContext(dn)!=null}function xn(){return ot(bn(),`useLocation() may be used only in the context of a <Router> component.`),v.useContext(dn).location}var Sn=`You should call navigate() in a React.useEffect(), not when your component is first rendered.`;function Cn(e){v.useContext(un).static||v.useLayoutEffect(e)}function wn(){let{isDataRoute:e}=v.useContext(fn);return e?Jn():Tn()}function Tn(){ot(bn(),`useNavigate() may be used only in the context of a <Router> component.`);let e=v.useContext(nn),{basename:t,navigator:n}=v.useContext(un),{matches:r}=v.useContext(fn),{pathname:i}=xn(),a=JSON.stringify(Vt(r)),o=v.useRef(!1);return Cn(()=>{o.current=!0}),v.useCallback((r,s={})=>{if(st(o.current,Sn),!o.current)return;if(typeof r==`number`){n.go(r);return}let c=Ht(r,JSON.parse(a),i,s.relative===`path`);e==null&&t!==`/`&&(c.pathname=c.pathname===`/`?t:Wt([t,c.pathname])),(s.replace?n.replace:n.push)(c,s.state,s)},[t,n,a,i,e])}var En=v.createContext(null);function Dn(e){let t=v.useContext(fn).outlet;return v.useMemo(()=>t&&v.createElement(En.Provider,{value:e},t),[t,e])}function On(){let{matches:e}=v.useContext(fn);return e[e.length-1]?.params??{}}function kn(e,{relative:t}={}){let{matches:n}=v.useContext(fn),{pathname:r}=xn(),i=JSON.stringify(Vt(n));return v.useMemo(()=>Ht(e,JSON.parse(i),r,t===`path`),[e,i,r,t])}function An(e,t){return jn(e,t)}function jn(e,t,n){ot(bn(),`useRoutes() may be used only in the context of a <Router> component.`);let{navigator:r}=v.useContext(un),{matches:i}=v.useContext(fn),a=i[i.length-1],o=a?a.params:{},s=a?a.pathname:`/`,c=a?a.pathnameBase:`/`,l=a&&a.route;{let e=l&&l.path||``;Xn(s,!l||e.endsWith(`*`)||e.endsWith(`*?`),`You rendered descendant <Routes> (or called \`useRoutes()\`) at "${s}" (under <Route path="${e}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${e}"> to <Route path="${e===`/`?`*`:`${e}/*`}">.`)}let u=xn(),d;if(t){let e=typeof t==`string`?ft(t):t;ot(c===`/`||e.pathname?.startsWith(c),`When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, the location pathname must begin with the portion of the URL pathname that was matched by all parent routes. The current pathname base is "${c}" but pathname "${e.pathname}" was given in the \`location\` prop.`),d=e}else d=u;let f=d.pathname||`/`,p=f;if(c!==`/`){let e=c.replace(/^\//,``).split(`/`);p=`/`+f.replace(/^\//,``).split(`/`).slice(e.length).join(`/`)}let m=n&&n.state.matches.length?n.state.matches.map(e=>Object.assign(e,{route:n.manifest[e.route.id]||e.route})):ht(e,{pathname:p});st(l||m!=null,`No routes matched location "${d.pathname}${d.search}${d.hash}" `),st(m==null||m[m.length-1].route.element!==void 0||m[m.length-1].route.Component!==void 0||m[m.length-1].route.lazy!==void 0,`Matched leaf route at location "${d.pathname}${d.search}${d.hash}" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`);let h=Rn(m&&m.map(e=>Object.assign({},e,{params:Object.assign({},o,e.params),pathname:Wt([c,r.encodeLocation?r.encodeLocation(e.pathname.replace(/%/g,`%25`).replace(/\?/g,`%3F`).replace(/#/g,`%23`)).pathname:e.pathname]),pathnameBase:e.pathnameBase===`/`?c:Wt([c,r.encodeLocation?r.encodeLocation(e.pathnameBase.replace(/%/g,`%25`).replace(/\?/g,`%3F`).replace(/#/g,`%23`)).pathname:e.pathnameBase])})),i,n);return t&&h?v.createElement(dn.Provider,{value:{location:{pathname:`/`,search:``,hash:``,state:null,key:`default`,mask:void 0,...d},navigationType:`POP`}},h):h}function Mn(){let e=qn(),t=Xt(e)?`${e.status} ${e.statusText}`:e instanceof Error?e.message:JSON.stringify(e),n=e instanceof Error?e.stack:null,r=`rgba(200,200,200, 0.5)`,i={padding:`0.5rem`,backgroundColor:r},a={padding:`2px 4px`,backgroundColor:r},o=null;return console.error(`Error handled by React Router default ErrorBoundary:`,e),o=v.createElement(v.Fragment,null,v.createElement(`p`,null,`💿 Hey developer 👋`),v.createElement(`p`,null,`You can provide a way better UX than this when your app throws errors by providing your own `,v.createElement(`code`,{style:a},`ErrorBoundary`),` or`,` `,v.createElement(`code`,{style:a},`errorElement`),` prop on your route.`)),v.createElement(v.Fragment,null,v.createElement(`h2`,null,`Unexpected Application Error!`),v.createElement(`h3`,{style:{fontStyle:`italic`}},t),n?v.createElement(`pre`,{style:i},n):null,o)}var Nn=v.createElement(Mn,null),Pn=class extends v.Component{constructor(e){super(e),this.state={location:e.location,revalidation:e.revalidation,error:e.error}}static getDerivedStateFromError(e){return{error:e}}static getDerivedStateFromProps(e,t){return t.location!==e.location||t.revalidation!==`idle`&&e.revalidation===`idle`?{error:e.error,location:e.location,revalidation:e.revalidation}:{error:e.error===void 0?t.error:e.error,location:t.location,revalidation:e.revalidation||t.revalidation}}componentDidCatch(e,t){this.props.onError?this.props.onError(e,t):console.error(`React Router caught the following error during render`,e)}render(){let e=this.state.error;if(this.context&&typeof e==`object`&&e&&`digest`in e&&typeof e.digest==`string`){let t=vn(e.digest);t&&(e=t)}let t=e===void 0?this.props.children:v.createElement(fn.Provider,{value:this.props.routeContext},v.createElement(pn.Provider,{value:e,children:this.props.component}));return this.context?v.createElement(In,{error:e},t):t}};Pn.contextType=an;var Fn=new WeakMap;function In({children:e,error:t}){let{basename:n}=v.useContext(un);if(typeof t==`object`&&t&&`digest`in t&&typeof t.digest==`string`){let e=_n(t.digest);if(e){let r=Fn.get(t);if(r)throw r;let i=$t(e.location,n);if(Qt&&!Fn.get(t))if(i.isExternal||e.reloadDocument)window.location.href=i.absoluteURL||i.to;else{let n=Promise.resolve().then(()=>window.__reactRouterDataRouter.navigate(i.to,{replace:e.replace}));throw Fn.set(t,n),n}return v.createElement(`meta`,{httpEquiv:`refresh`,content:`0;url=${i.absoluteURL||i.to}`})}}return e}function Ln({routeContext:e,match:t,children:n}){let r=v.useContext(nn);return r&&r.static&&r.staticContext&&(t.route.errorElement||t.route.ErrorBoundary)&&(r.staticContext._deepestRenderedBoundaryId=t.route.id),v.createElement(fn.Provider,{value:e},n)}function Rn(e,t=[],n){let r=n?.state;if(e==null){if(!r)return null;if(r.errors)e=r.matches;else if(t.length===0&&!r.initialized&&r.matches.length>0)e=r.matches;else return null}let i=e,a=r?.errors;if(a!=null){let e=i.findIndex(e=>e.route.id&&a?.[e.route.id]!==void 0);ot(e>=0,`Could not find a matching route for errors on route IDs: ${Object.keys(a).join(`,`)}`),i=i.slice(0,Math.min(i.length,e+1))}let o=!1,s=-1;if(n&&r){o=r.renderFallback;for(let e=0;e<i.length;e++){let t=i[e];if((t.route.HydrateFallback||t.route.hydrateFallbackElement)&&(s=e),t.route.id){let{loaderData:e,errors:a}=r,c=t.route.loader&&!e.hasOwnProperty(t.route.id)&&(!a||a[t.route.id]===void 0);if(t.route.lazy||c){n.isStatic&&(o=!0),i=s>=0?i.slice(0,s+1):[i[0]];break}}}}let c=n?.onError,l=r&&c?(e,t)=>{c(e,{location:r.location,params:r.matches?.[0]?.params??{},pattern:Zt(r.matches),errorInfo:t})}:void 0;return i.reduceRight((e,n,c)=>{let u,d=!1,f=null,p=null;r&&(u=a&&n.route.id?a[n.route.id]:void 0,f=n.route.errorElement||Nn,o&&(s<0&&c===0?(Xn(`route-fallback`,!1,"No `HydrateFallback` element provided to render during initial hydration"),d=!0,p=null):s===c&&(d=!0,p=n.route.hydrateFallbackElement||null)));let m=t.concat(i.slice(0,c+1)),h=()=>{let t;return t=u?f:d?p:n.route.Component?v.createElement(n.route.Component,null):n.route.element?n.route.element:e,v.createElement(Ln,{match:n,routeContext:{outlet:e,matches:m,isDataRoute:r!=null},children:t})};return r&&(n.route.ErrorBoundary||n.route.errorElement||c===0)?v.createElement(Pn,{location:r.location,revalidation:r.revalidation,component:f,error:u,children:h(),routeContext:{outlet:null,matches:m,isDataRoute:!0},onError:l}):h()},null)}function zn(e){return`${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function Bn(e){let t=v.useContext(nn);return ot(t,zn(e)),t}function Vn(e){let t=v.useContext(rn);return ot(t,zn(e)),t}function Hn(e){let t=v.useContext(fn);return ot(t,zn(e)),t}function Un(e){let t=Hn(e),n=t.matches[t.matches.length-1];return ot(n.route.id,`${e} can only be used on routes that contain a unique "id"`),n.route.id}function Wn(){return Un(`useRouteId`)}function Gn(){let e=Vn(`useNavigation`);return v.useMemo(()=>{let{matches:t,historyAction:n,...r}=e.navigation;return r},[e.navigation])}function Kn(){let{matches:e,loaderData:t}=Vn(`useMatches`);return v.useMemo(()=>e.map(e=>_t(e,t)),[e,t])}function qn(){let e=v.useContext(pn),t=Vn(`useRouteError`),n=Un(`useRouteError`);return e===void 0?t.errors?.[n]:e}function Jn(){let{router:e}=Bn(`useNavigate`),t=Un(`useNavigate`),n=v.useRef(!1);return Cn(()=>{n.current=!0}),v.useCallback(async(r,i={})=>{st(n.current,Sn),n.current&&(typeof r==`number`?await e.navigate(r):await e.navigate(r,{fromRouteId:t,...i}))},[e,t])}var Yn={};function Xn(e,t,n){!t&&!Yn[e]&&(Yn[e]=!0,st(!1,n))}v.memo(Zn);function Zn({routes:e,manifest:t,future:n,state:r,isStatic:i,onError:a}){return jn(e,void 0,{manifest:t,state:r,isStatic:i,onError:a,future:n})}function Qn({to:e,replace:t,state:n,relative:r}){ot(bn(),`<Navigate> may be used only in the context of a <Router> component.`);let{static:i}=v.useContext(un);st(!i,`<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.`);let{matches:a}=v.useContext(fn),{pathname:o}=xn(),s=wn(),c=Ht(e,Vt(a),o,r===`path`),l=JSON.stringify(c);return v.useEffect(()=>{s(JSON.parse(l),{replace:t,state:n,relative:r})},[s,l,r,t,n]),null}function $n(e){return Dn(e.context)}function er(e){ot(!1,`A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.`)}function tr({basename:e=`/`,children:t=null,location:n,navigationType:r=`POP`,navigator:i,static:a=!1,useTransitions:o}){ot(!bn(),`You cannot render a <Router> inside another <Router>. You should never have more than one in your app.`);let s=e.replace(/^\/*/,`/`),c=v.useMemo(()=>({basename:s,navigator:i,static:a,useTransitions:o,future:{}}),[s,i,a,o]);typeof n==`string`&&(n=ft(n));let{pathname:l=`/`,search:u=``,hash:d=``,state:f=null,key:p=`default`,mask:m}=n,h=v.useMemo(()=>{let e=Ft(l,s);return e==null?null:{location:{pathname:e,search:u,hash:d,state:f,key:p,mask:m},navigationType:r}},[s,l,u,d,f,p,r,m]);return st(h!=null,`<Router basename="${s}"> is not able to match the URL "${l}${u}${d}" because it does not start with the basename, so the <Router> won't render anything.`),h==null?null:v.createElement(un.Provider,{value:c},v.createElement(dn.Provider,{children:t,value:h}))}function nr({children:e,location:t}){return An(rr(e),t)}v.Component;function rr(e,t=[]){let n=[];return v.Children.forEach(e,(e,r)=>{if(!v.isValidElement(e))return;let i=[...t,r];if(e.type===v.Fragment){n.push.apply(n,rr(e.props.children,i));return}ot(e.type===er,`[${typeof e.type==`string`?e.type:e.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`),ot(!e.props.index||!e.props.children,`An index route cannot have child routes.`);let a={id:e.props.id||i.join(`-`),caseSensitive:e.props.caseSensitive,element:e.props.element,Component:e.props.Component,index:e.props.index,path:e.props.path,middleware:e.props.middleware,loader:e.props.loader,action:e.props.action,hydrateFallbackElement:e.props.hydrateFallbackElement,HydrateFallback:e.props.HydrateFallback,errorElement:e.props.errorElement,ErrorBoundary:e.props.ErrorBoundary,hasErrorBoundary:e.props.hasErrorBoundary===!0||e.props.ErrorBoundary!=null||e.props.errorElement!=null,shouldRevalidate:e.props.shouldRevalidate,handle:e.props.handle,lazy:e.props.lazy};e.props.children&&(a.children=rr(e.props.children,i)),n.push(a)}),n}var ir=`get`,ar=`application/x-www-form-urlencoded`;function or(e){return typeof HTMLElement<`u`&&e instanceof HTMLElement}function sr(e){return or(e)&&e.tagName.toLowerCase()===`button`}function cr(e){return or(e)&&e.tagName.toLowerCase()===`form`}function lr(e){return or(e)&&e.tagName.toLowerCase()===`input`}function ur(e){return!!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)}function dr(e,t){return e.button===0&&(!t||t===`_self`)&&!ur(e)}function fr(e=``){return new URLSearchParams(typeof e==`string`||Array.isArray(e)||e instanceof URLSearchParams?e:Object.keys(e).reduce((t,n)=>{let r=e[n];return t.concat(Array.isArray(r)?r.map(e=>[n,e]):[[n,r]])},[]))}function pr(e,t){let n=fr(e);return t&&t.forEach((e,r)=>{n.has(r)||t.getAll(r).forEach(e=>{n.append(r,e)})}),n}var mr=null;function hr(){if(mr===null)try{new FormData(document.createElement(`form`),0),mr=!1}catch{mr=!0}return mr}var gr=new Set([`application/x-www-form-urlencoded`,`multipart/form-data`,`text/plain`]);function _r(e){return e!=null&&!gr.has(e)?(st(!1,`"${e}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${ar}"`),null):e}function vr(e,t){let n,r,i,a,o;if(cr(e)){let o=e.getAttribute(`action`);r=o?Ft(o,t):null,n=e.getAttribute(`method`)||ir,i=_r(e.getAttribute(`enctype`))||ar,a=new FormData(e)}else if(sr(e)||lr(e)&&(e.type===`submit`||e.type===`image`)){let o=e.form;if(o==null)throw Error(`Cannot submit a <button> or <input type="submit"> without a <form>`);let s=e.getAttribute(`formaction`)||o.getAttribute(`action`);if(r=s?Ft(s,t):null,n=e.getAttribute(`formmethod`)||o.getAttribute(`method`)||ir,i=_r(e.getAttribute(`formenctype`))||_r(o.getAttribute(`enctype`))||ar,a=new FormData(o,e),!hr()){let{name:t,type:n,value:r}=e;if(n===`image`){let e=t?`${t}.`:``;a.append(`${e}x`,`0`),a.append(`${e}y`,`0`)}else t&&a.append(t,r)}}else if(or(e))throw Error(`Cannot submit element that is not <form>, <button>, or <input type="submit|image">`);else n=ir,r=null,i=ar,o=e;return a&&i===`text/plain`&&(o=a,a=void 0),{action:r,method:n.toLowerCase(),encType:i,formData:a,body:o}}Object.getOwnPropertyNames(Object.prototype).sort().join(`\0`);var yr={"&":`\\u0026`,">":`\\u003e`,"<":`\\u003c`,"\u2028":`\\u2028`,"\u2029":`\\u2029`},br=/[&><\u2028\u2029]/g;function xr(e){return e.replace(br,e=>yr[e])}function Sr(e,t){if(e===!1||e==null)throw Error(t)}function Cr(e,t,n,r){let i=typeof e==`string`?new URL(e,typeof window>`u`?`server://singlefetch/`:window.location.origin):e;return n?i.pathname.endsWith(`/`)?i.pathname=`${i.pathname}_.${r}`:i.pathname=`${i.pathname}.${r}`:i.pathname===`/`?i.pathname=`_root.${r}`:t&&Ft(i.pathname,t)===`/`?i.pathname=`${Gt(t)}/_root.${r}`:i.pathname=`${Gt(i.pathname)}.${r}`,i}async function wr(e,t){if(e.id in t)return t[e.id];try{let n=await nt(()=>import(e.module),[]);return t[e.id]=n,n}catch(t){return console.error(`Error loading route module \`${e.module}\`, reloading page...`),console.error(t),window.__reactRouterContext&&window.__reactRouterContext.isSpaMode,window.location.reload(),new Promise(()=>{})}}function Tr(e){return e!=null&&typeof e.page==`string`}function Er(e){return e==null?!1:e.href==null?e.rel===`preload`&&typeof e.imageSrcSet==`string`&&typeof e.imageSizes==`string`:typeof e.rel==`string`&&typeof e.href==`string`}async function Dr(e,t,n){return Mr((await Promise.all(e.map(async e=>{let r=t.routes[e.route.id];if(r){let e=await wr(r,n);return e.links?e.links():[]}return[]}))).flat(1).filter(Er).filter(e=>e.rel===`stylesheet`||e.rel===`preload`).map(e=>e.rel===`stylesheet`?{...e,rel:`prefetch`,as:`style`}:{...e,rel:`prefetch`}))}function Or(e,t,n,r,i,a){let o=(e,t)=>n[t]?e.route.id!==n[t].route.id:!0,s=(e,t)=>n[t].pathname!==e.pathname||n[t].route.path?.endsWith(`*`)&&n[t].params[`*`]!==e.params[`*`];return a===`assets`?t.filter((e,t)=>o(e,t)||s(e,t)):a===`data`?t.filter((t,a)=>{let c=r.routes[t.route.id];if(!c||!c.hasLoader)return!1;if(o(t,a)||s(t,a))return!0;if(t.route.shouldRevalidate){let r=t.route.shouldRevalidate({currentUrl:new URL(i.pathname+i.search+i.hash,window.origin),currentParams:n[0]?.params||{},nextUrl:new URL(e,window.origin),nextParams:t.params,defaultShouldRevalidate:!0});if(typeof r==`boolean`)return r}return!0}):[]}function kr(e,t,{includeHydrateFallback:n}={}){return Ar(e.map(e=>{let r=t.routes[e.route.id];if(!r)return[];let i=[r.module];return r.clientActionModule&&(i=i.concat(r.clientActionModule)),r.clientLoaderModule&&(i=i.concat(r.clientLoaderModule)),n&&r.hydrateFallbackModule&&(i=i.concat(r.hydrateFallbackModule)),r.imports&&(i=i.concat(r.imports)),i}).flat(1))}function Ar(e){return[...new Set(e)]}function jr(e){let t={},n=Object.keys(e).sort();for(let r of n)t[r]=e[r];return t}function Mr(e,t){let n=new Set,r=new Set(t);return e.reduce((e,i)=>{if(t&&!Tr(i)&&i.as===`script`&&i.href&&r.has(i.href))return e;let a=JSON.stringify(jr(i));return n.has(a)||(n.add(a),e.push({key:a,link:i})),e},[])}function Nr(){let e=v.useContext(nn);return Sr(e,`You must render this element inside a <DataRouterContext.Provider> element`),e}function Pr(){let e=v.useContext(rn);return Sr(e,`You must render this element inside a <DataRouterStateContext.Provider> element`),e}var Fr=v.createContext(void 0);Fr.displayName=`FrameworkContext`;function Ir(){let e=v.useContext(Fr);return Sr(e,`You must render this element inside a <HydratedRouter> element`),e}function Lr(e,t){let n=v.useContext(Fr),[r,i]=v.useState(!1),[a,o]=v.useState(!1),{onFocus:s,onBlur:c,onMouseEnter:l,onMouseLeave:u,onTouchStart:d}=t,f=v.useRef(null);v.useEffect(()=>{if(e===`render`&&o(!0),e===`viewport`){let e=new IntersectionObserver(e=>{e.forEach(e=>{o(e.isIntersecting)})},{threshold:.5});return f.current&&e.observe(f.current),()=>{e.disconnect()}}},[e]),v.useEffect(()=>{if(r){let e=setTimeout(()=>{o(!0)},100);return()=>{clearTimeout(e)}}},[r]);let p=()=>{i(!0)},m=()=>{i(!1),o(!1)};return n?e===`intent`?[a,f,{onFocus:Rr(s,p),onBlur:Rr(c,m),onMouseEnter:Rr(l,p),onMouseLeave:Rr(u,m),onTouchStart:Rr(d,p)}]:[a,f,{}]:[!1,f,{}]}function Rr(e,t){return n=>{e&&e(n),n.defaultPrevented||t(n)}}function zr({page:e,...t}){let n=on(),{router:r}=Nr(),i=v.useMemo(()=>ht(r.routes,e,r.basename),[r.routes,e,r.basename]);return i?n?v.createElement(Vr,{page:e,matches:i,...t}):v.createElement(Hr,{page:e,matches:i,...t}):null}function Br(e){let{manifest:t,routeModules:n}=Ir(),[r,i]=v.useState([]);return v.useEffect(()=>{let r=!1;return Dr(e,t,n).then(e=>{r||i(e)}),()=>{r=!0}},[e,t,n]),r}function Vr({page:e,matches:t,...n}){let r=xn(),{future:i}=Ir(),{basename:a}=Nr(),o=v.useMemo(()=>{if(e===r.pathname+r.search+r.hash)return[];let n=Cr(e,a,i.v8_trailingSlashAwareDataRequests,`rsc`),o=!1,s=[];for(let e of t)typeof e.route.shouldRevalidate==`function`?o=!0:s.push(e.route.id);return o&&s.length>0&&n.searchParams.set(`_routes`,s.join(`,`)),[n.pathname+n.search]},[a,i.v8_trailingSlashAwareDataRequests,e,r,t]);return v.createElement(v.Fragment,null,o.map(e=>v.createElement(`link`,{key:e,rel:`prefetch`,as:`fetch`,href:e,...n})))}function Hr({page:e,matches:t,...n}){let r=xn(),{future:i,manifest:a,routeModules:o}=Ir(),{basename:s}=Nr(),{loaderData:c,matches:l}=Pr(),u=v.useMemo(()=>Or(e,t,l,a,r,`data`),[e,t,l,a,r]),d=v.useMemo(()=>Or(e,t,l,a,r,`assets`),[e,t,l,a,r]),f=v.useMemo(()=>{if(e===r.pathname+r.search+r.hash)return[];let n=new Set,l=!1;if(t.forEach(e=>{let t=a.routes[e.route.id];!t||!t.hasLoader||(!u.some(t=>t.route.id===e.route.id)&&e.route.id in c&&o[e.route.id]?.shouldRevalidate||t.hasClientLoader?l=!0:n.add(e.route.id))}),n.size===0)return[];let d=Cr(e,s,i.v8_trailingSlashAwareDataRequests,`data`);return l&&n.size>0&&d.searchParams.set(`_routes`,t.filter(e=>n.has(e.route.id)).map(e=>e.route.id).join(`,`)),[d.pathname+d.search]},[s,i.v8_trailingSlashAwareDataRequests,c,r,a,u,t,e,o]),p=v.useMemo(()=>kr(d,a),[d,a]),m=Br(d);return v.createElement(v.Fragment,null,f.map(e=>v.createElement(`link`,{key:e,rel:`prefetch`,as:`fetch`,href:e,...n})),p.map(e=>v.createElement(`link`,{key:e,rel:`modulepreload`,href:e,...n})),m.map(({key:e,link:t})=>v.createElement(`link`,{key:e,nonce:n.nonce,...t,crossOrigin:t.crossOrigin??n.crossOrigin})))}function Ur(...e){return t=>{e.forEach(e=>{typeof e==`function`?e(t):e!=null&&(e.current=t)})}}v.Component;var Wr=typeof window<`u`&&window.document!==void 0&&window.document.createElement!==void 0;try{Wr&&(window.__reactRouterVersion=`7.17.0`)}catch{}function Gr({basename:e,children:t,useTransitions:n,window:r}){let i=v.useRef();i.current??=at({window:r,v5Compat:!0});let a=i.current,[o,s]=v.useState({action:a.action,location:a.location}),c=v.useCallback(e=>{n===!1?s(e):v.startTransition(()=>s(e))},[n]);return v.useLayoutEffect(()=>a.listen(c),[a,c]),v.createElement(tr,{basename:e,children:t,location:o.location,navigationType:o.action,navigator:a,useTransitions:n})}function Kr({basename:e,children:t,history:n,useTransitions:r}){let[i,a]=v.useState({action:n.action,location:n.location}),o=v.useCallback(e=>{r===!1?a(e):v.startTransition(()=>a(e))},[r]);return v.useLayoutEffect(()=>n.listen(o),[n,o]),v.createElement(tr,{basename:e,children:t,location:i.location,navigationType:i.action,navigator:n,useTransitions:r})}Kr.displayName=`unstable_HistoryRouter`;var qr=/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i,Jr=v.forwardRef(function({onClick:e,discover:t=`render`,prefetch:n=`none`,relative:r,reloadDocument:i,replace:a,mask:o,state:s,target:c,to:l,preventScrollReset:u,viewTransition:d,defaultShouldRevalidate:f,...p},m){let{basename:h,navigator:g,useTransitions:_}=v.useContext(un),y=typeof l==`string`&&qr.test(l),b=$t(l,h);l=b.to;let x=yn(l,{relative:r}),S=xn(),C=null;if(o){let e=Ht(o,[],S.mask?S.mask.pathname:`/`,!0);h!==`/`&&(e.pathname=e.pathname===`/`?h:Wt([h,e.pathname])),C=g.createHref(e)}let[w,T,E]=Lr(n,p),D=ti(l,{replace:a,mask:o,state:s,target:c,preventScrollReset:u,relative:r,viewTransition:d,defaultShouldRevalidate:f,useTransitions:_});function O(t){e&&e(t),t.defaultPrevented||D(t)}let k=!(b.isExternal||i),A=v.createElement(`a`,{...p,...E,href:(k?C:void 0)||b.absoluteURL||x,onClick:k?O:e,ref:Ur(m,T),target:c,"data-discover":!y&&t===`render`?`true`:void 0});return w&&!y?v.createElement(v.Fragment,null,A,v.createElement(zr,{page:x})):A});Jr.displayName=`Link`;var Yr=v.forwardRef(function({"aria-current":e=`page`,caseSensitive:t=!1,className:n=``,end:r=!1,style:i,to:a,viewTransition:o,children:s,...c},l){let u=kn(a,{relative:c.relative}),d=xn(),f=v.useContext(rn),{navigator:p,basename:m}=v.useContext(un),h=f!=null&&fi(u)&&o===!0,g=p.encodeLocation?p.encodeLocation(u).pathname:u.pathname,_=d.pathname,y=f&&f.navigation&&f.navigation.location?f.navigation.location.pathname:null;t||(_=_.toLowerCase(),y=y?y.toLowerCase():null,g=g.toLowerCase()),y&&m&&(y=Ft(y,m)||y);let b=g!==`/`&&g.endsWith(`/`)?g.length-1:g.length,x=_===g||!r&&_.startsWith(g)&&_.charAt(b)===`/`,S=y!=null&&(y===g||!r&&y.startsWith(g)&&y.charAt(g.length)===`/`),C={isActive:x,isPending:S,isTransitioning:h},w=x?e:void 0,T;T=typeof n==`function`?n(C):[n,x?`active`:null,S?`pending`:null,h?`transitioning`:null].filter(Boolean).join(` `);let E=typeof i==`function`?i(C):i;return v.createElement(Jr,{...c,"aria-current":w,className:T,ref:l,style:E,to:a,viewTransition:o},typeof s==`function`?s(C):s)});Yr.displayName=`NavLink`;var Xr=v.forwardRef(({discover:e=`render`,fetcherKey:t,navigate:n,reloadDocument:r,replace:i,state:a,method:o=ir,action:s,onSubmit:c,relative:l,preventScrollReset:u,viewTransition:d,defaultShouldRevalidate:f,...p},m)=>{let{useTransitions:h}=v.useContext(un),g=ai(),_=oi(s,{relative:l}),y=o.toLowerCase()===`get`?`get`:`post`,b=typeof s==`string`&&qr.test(s);return v.createElement(`form`,{ref:m,method:y,action:_,onSubmit:r?c:e=>{if(c&&c(e),e.defaultPrevented)return;e.preventDefault();let r=e.nativeEvent.submitter,s=r?.getAttribute(`formmethod`)||o,p=()=>g(r||e.currentTarget,{fetcherKey:t,method:s,navigate:n,replace:i,state:a,relative:l,preventScrollReset:u,viewTransition:d,defaultShouldRevalidate:f});h&&n!==!1?v.startTransition(()=>p()):p()},...p,"data-discover":!b&&e===`render`?`true`:void 0})});Xr.displayName=`Form`;function Zr({getKey:e,storageKey:t,...n}){let r=v.useContext(Fr),{basename:i}=v.useContext(un),a=xn(),o=Kn();ui({getKey:e,storageKey:t});let s=v.useMemo(()=>{if(!r||!e)return null;let t=li(a,o,i,e);return t===a.key?null:t},[]);if(!r||r.isSpaMode)return null;let c=((e,t)=>{if(!window.history.state||!window.history.state.key){let e=Math.random().toString(32).slice(2);window.history.replaceState({key:e},``)}try{let n=JSON.parse(sessionStorage.getItem(e)||`{}`)[t||window.history.state.key];typeof n==`number`&&window.scrollTo(0,n)}catch(t){console.error(t),sessionStorage.removeItem(e)}}).toString();return v.createElement(`script`,{...n,suppressHydrationWarning:!0,dangerouslySetInnerHTML:{__html:`(${c})(${xr(JSON.stringify(t||si))}, ${xr(JSON.stringify(s))})`}})}Zr.displayName=`ScrollRestoration`;function Qr(e){return`${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function $r(e){let t=v.useContext(nn);return ot(t,Qr(e)),t}function ei(e){let t=v.useContext(rn);return ot(t,Qr(e)),t}function ti(e,{target:t,replace:n,mask:r,state:i,preventScrollReset:a,relative:o,viewTransition:s,defaultShouldRevalidate:c,useTransitions:l}={}){let u=wn(),d=xn(),f=kn(e,{relative:o});return v.useCallback(p=>{if(dr(p,t)){p.preventDefault();let t=n===void 0?dt(d)===dt(f):n,m=()=>u(e,{replace:t,mask:r,state:i,preventScrollReset:a,relative:o,viewTransition:s,defaultShouldRevalidate:c});l?v.startTransition(()=>m()):m()}},[d,u,f,n,r,i,t,e,a,o,s,c,l])}function ni(e){st(typeof URLSearchParams<`u`,"You cannot use the `useSearchParams` hook in a browser that does not support the URLSearchParams API. If you need to support Internet Explorer 11, we recommend you load a polyfill such as https://github.com/ungap/url-search-params.");let t=v.useRef(fr(e)),n=v.useRef(!1),r=xn(),i=v.useMemo(()=>pr(r.search,n.current?null:t.current),[r.search]),a=wn();return[i,v.useCallback((e,t)=>{let r=fr(typeof e==`function`?e(new URLSearchParams(i)):e);n.current=!0,a(`?`+r,t)},[a,i])]}var ri=0,ii=()=>`__${String(++ri)}__`;function ai(){let{router:e}=$r(`useSubmit`),{basename:t}=v.useContext(un),n=Wn(),r=e.fetch,i=e.navigate;return v.useCallback(async(e,a={})=>{let{action:o,method:s,encType:c,formData:l,body:u}=vr(e,t);a.navigate===!1?await r(a.fetcherKey||ii(),n,a.action||o,{defaultShouldRevalidate:a.defaultShouldRevalidate,preventScrollReset:a.preventScrollReset,formData:l,body:u,formMethod:a.method||s,formEncType:a.encType||c,flushSync:a.flushSync}):await i(a.action||o,{defaultShouldRevalidate:a.defaultShouldRevalidate,preventScrollReset:a.preventScrollReset,formData:l,body:u,formMethod:a.method||s,formEncType:a.encType||c,replace:a.replace,state:a.state,fromRouteId:n,flushSync:a.flushSync,viewTransition:a.viewTransition})},[r,i,t,n])}function oi(e,{relative:t}={}){let{basename:n}=v.useContext(un),r=v.useContext(fn);ot(r,`useFormAction must be used inside a RouteContext`);let[i]=r.matches.slice(-1),a={...kn(e||`.`,{relative:t})},o=xn();if(e==null){a.search=o.search;let e=new URLSearchParams(a.search),t=e.getAll(`index`);if(t.some(e=>e===``)){e.delete(`index`),t.filter(e=>e).forEach(t=>e.append(`index`,t));let n=e.toString();a.search=n?`?${n}`:``}}return(!e||e===`.`)&&i.route.index&&(a.search=a.search?a.search.replace(/^\?/,`?index&`):`?index`),n!==`/`&&(a.pathname=a.pathname===`/`?n:Wt([n,a.pathname])),dt(a)}var si=`react-router-scroll-positions`,ci={};function li(e,t,n,r){let i=null;return r&&(i=r(n===`/`?e:{...e,pathname:Ft(e.pathname,n)||e.pathname},t)),i??=e.key,i}function ui({getKey:e,storageKey:t}={}){let{router:n}=$r(`useScrollRestoration`),{restoreScrollPosition:r,preventScrollReset:i}=ei(`useScrollRestoration`),{basename:a}=v.useContext(un),o=xn(),s=Kn(),c=Gn();v.useEffect(()=>(window.history.scrollRestoration=`manual`,()=>{window.history.scrollRestoration=`auto`}),[]),di(v.useCallback(()=>{if(c.state===`idle`){let t=li(o,s,a,e);ci[t]=window.scrollY}try{sessionStorage.setItem(t||si,JSON.stringify(ci))}catch(e){st(!1,`Failed to save scroll positions in sessionStorage, <ScrollRestoration /> will not work properly (${e}).`)}window.history.scrollRestoration=`auto`},[c.state,e,a,o,s,t])),typeof document<`u`&&(v.useLayoutEffect(()=>{try{let e=sessionStorage.getItem(t||si);e&&(ci=JSON.parse(e))}catch{}},[t]),v.useLayoutEffect(()=>{let t=n?.enableScrollRestoration(ci,()=>window.scrollY,e?(t,n)=>li(t,n,a,e):void 0);return()=>t&&t()},[n,a,e]),v.useLayoutEffect(()=>{if(r!==!1){if(typeof r==`number`){window.scrollTo(0,r);return}try{if(o.hash){let e=document.getElementById(decodeURIComponent(o.hash.slice(1)));if(e){e.scrollIntoView();return}}}catch{st(!1,`"${o.hash.slice(1)}" is not a decodable element ID. The view will not scroll to it.`)}i!==!0&&window.scrollTo(0,0)}},[o,r,i]))}function di(e,t){let{capture:n}=t||{};v.useEffect(()=>{let t=n==null?void 0:{capture:n};return window.addEventListener(`pagehide`,e,t),()=>{window.removeEventListener(`pagehide`,e,t)}},[e,n])}function fi(e,{relative:t}={}){let n=v.useContext(sn);ot(n!=null,"`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?");let{basename:r}=$r(`useViewTransitionState`),i=kn(e,{relative:t});if(!n.isTransitioning)return!1;let a=Ft(n.currentLocation.pathname,r)||n.currentLocation.pathname,o=Ft(n.nextLocation.pathname,r)||n.nextLocation.pathname;return Mt(i.pathname,o)!=null||Mt(i.pathname,a)!=null}function pi(){return j(`/nodes`)}function mi(){return j(`/nodes/models`)}function hi(){return j(`/nodes/ggufs`)}function gi(e,t){return M(`/nodes/${encodeURIComponent(e)}/models/${encodeURIComponent(t)}/start`)}function _i(e,t){return M(`/nodes/${encodeURIComponent(e)}/models/${encodeURIComponent(t)}/stop`)}function vi(e,t){return M(`/nodes/${encodeURIComponent(e)}/models/${encodeURIComponent(t)}/restart`)}function yi(e){return j(`/transfers/${encodeURIComponent(e)}`)}function bi(e,t){return N(`/nodes/${encodeURIComponent(e)}`,t)}var xi=(0,v.createContext)({appMode:``,status:`Backend status unknown`,controllerUrl:null,controllerReachable:null,agentNodes:[],refreshKey:0,globalRefreshing:!1,refreshGlobal:async()=>{}});function Si({children:e}){let{authToken:t}=U(),[n,r]=(0,v.useState)(`Backend status unknown`),[i,a]=(0,v.useState)(``),[o,s]=(0,v.useState)(null),[c,l]=(0,v.useState)(null),[u,d]=(0,v.useState)([]),[f,p]=(0,v.useState)(0),[m,h]=(0,v.useState)(!1),g=(0,v.useCallback)(async(e=!0)=>{h(!0);try{let t=await S(),n=String(t.mode||``);if(a(n),s(typeof t.controller_url==`string`?t.controller_url:null),r(`Backend online`),n===`controller`)try{let e=await pi();d((Array.isArray(e)?e:e?.nodes??[]).filter(e=>e.name&&e.url).map(e=>({name:String(e.name),url:String(e.url),reachable:e.heartbeat_fresh===!0})))}catch{}else d([]);if(n===`agent`)try{l((await C()).reachable)}catch{l(null)}else l(null);e&&p(e=>e+1)}catch{r(`Backend offline`)}finally{h(!1)}},[]);(0,v.useEffect)(()=>{g(!1)},[g]),(0,v.useEffect)(()=>{t&&p(e=>e+1)},[t]);let _=(0,v.useMemo)(()=>({appMode:i,status:n,controllerUrl:o,controllerReachable:c,agentNodes:u,refreshKey:f,globalRefreshing:m,refreshGlobal:g}),[i,n,o,c,u,f,m,g]);return(0,R.jsx)(xi.Provider,{value:_,children:e})}function Ci(){return(0,v.useContext)(xi)}var wi=(0,v.createContext)({isOpen:!1,selection:null,openLogs:()=>{},closeLogs:()=>{}});function Ti({children:e}){let[t,n]=(0,v.useState)(!1),[r,i]=(0,v.useState)(null),a=(0,v.useCallback)(e=>{e&&i({...e,requestId:Date.now()}),n(!0)},[]),o=(0,v.useCallback)(()=>{n(!1)},[]),s=(0,v.useMemo)(()=>({isOpen:t,selection:r,openLogs:a,closeLogs:o}),[t,r,a,o]);return(0,R.jsx)(wi.Provider,{value:s,children:e})}function Ei(){return(0,v.useContext)(wi)}function Di(){return j(`/plugins/enabled`)}function Oi(){return j(`/plugins/status`)}function ki(e){return j(`/plugins/${encodeURIComponent(e)}/migrations/status`)}function Ai(e,t){return M(`/plugins/${encodeURIComponent(e)}/migrations/${encodeURIComponent(t)}/upgrade`)}function ji(e){return M(`/plugins/${encodeURIComponent(e)}/activate`)}function Mi(e){return M(`/plugins/${encodeURIComponent(e)}/deactivate`)}var Ni=`llama-pack.pluginNavigation`,Pi=(0,v.createContext)({enabledPlugins:[],pluginPages:[],pluginStatusIssues:[]});function Fi({children:e}){let{authToken:t}=U(),[n,r]=(0,v.useState)(()=>Li()),[i,a]=(0,v.useState)([]),o=(0,v.useMemo)(()=>n.flatMap(e=>Vi(e)),[n]);(0,v.useEffect)(()=>{let e=!0;return Promise.allSettled([Di(),Oi()]).then(([t,n])=>{if(!e)return;let i=n.status===`fulfilled`?n.value:null,o=t.status===`fulfilled`&&Array.isArray(t.value)?t.value:null;o&&o.length>0?(Ri(o),r(o)):o&&Bi(i)&&(Ri([]),r([])),a(n.status===`fulfilled`?Ui(n.value):[])}),()=>{e=!1}},[t]);let s=(0,v.useMemo)(()=>({enabledPlugins:n,pluginPages:o,pluginStatusIssues:i}),[n,o,i]);return(0,R.jsx)(Pi.Provider,{value:s,children:e})}function Ii(){return(0,v.useContext)(Pi)}function Li(){try{let e=window.localStorage.getItem(Ni),t=e?JSON.parse(e):[];return Array.isArray(t)?t.filter(zi):[]}catch{return[]}}function Ri(e){try{e.length===0?window.localStorage.removeItem(Ni):window.localStorage.setItem(Ni,JSON.stringify(e))}catch{}}function zi(e){if(!e||typeof e!=`object`)return!1;let t=e;return typeof t.id==`string`&&typeof t.name==`string`&&typeof t.version==`string`&&t.status===`enabled`}function Bi(e){let t=Array.isArray(e?.plugins)?e.plugins:[];return t.length>0&&t.every(e=>e.status!==`enabled`)}function Vi(e){let t=(e.frontend?.pages||[]).filter(t=>typeof t.route==`string`&&t.route.startsWith(`/ui/plugins/${e.id}`)).map(t=>({label:t.title||e.name,path:t.route})),n=t.length>1?t.map(e=>({label:e.label,path:e.path})):(e.secondary_navigation||[]).map(e=>Wi(e)).filter(e=>e!==null),r=t.length>0?[t[0]]:(e.navigation||[]).map((t,n)=>Wi(t,e.name,`/ui/plugins/${e.id}`,n)).filter(e=>e!==null),i=t.length>0?t:(e.ui_routes||[]).map((t,n)=>Wi(t,e.name,`/ui/plugins/${e.id}`,n)).filter(e=>e!==null),a=new Map;for(let t of r){let r=i.find(e=>e.path===t.path);a.set(t.path,Hi(e,t.path,r?.label||t.label,n,{navLabel:t.label}))}for(let t of i)a.has(t.path)||a.set(t.path,Hi(e,t.path,t.label,n,{hideFromPrimary:!0}));for(let t of n)a.has(t.path)||a.set(t.path,Hi(e,t.path,t.label,n,{hideFromPrimary:!0}));return Array.from(a.values())}function Hi(e,t,n,r,i={}){return{key:`plugin:${e.id}:${t}`,label:n,path:t,icon:`settings`,section:`plugins`,pluginId:e.id,pluginName:e.name,secondaryNavigation:r,...i}}function Ui(e){let t=Array.isArray(e?.plugins)?e.plugins:[],n=[];for(let e of t){let t=e.id||`unknown plugin`;e.status&&![`enabled`,`disabled`].includes(e.status)&&n.push(`${t} is ${e.status}`);for(let r of e.warnings||[])n.push(`${t}: ${r}`);for(let r of e.errors||[])n.push(`${t}: ${r}`);for(let r of e.health||[]){let e=String(r.level||``).toLowerCase(),i=String(r.message||``);i&&[`warning`,`error`].includes(e)&&n.push(`${t}: ${i}`)}}return Array.from(new Set(n)).slice(0,5)}function Wi(e,t=`Plugin`,n=``,r=0){let i=typeof e.path==`string`&&e.path.startsWith(`/ui/`)?e.path:n;return i?{label:typeof e.label==`string`&&e.label.trim()?e.label.trim():r===0?t:i,path:i}:null}var Gi=`/ui/setup`;function Ki(){let e=xn(),{bootstrapRequired:t}=U(),n=e.pathname===Gi;return t===!0&&!n?(0,R.jsx)(Qn,{to:Gi,replace:!0}):(0,R.jsx)($n,{})}var qi=(0,v.createContext)({appMode:``});function Ji({appMode:e,children:t}){return(0,R.jsx)(qi.Provider,{value:{appMode:e},children:t})}function Yi(){return(0,v.useContext)(qi).appMode}var Xi=[{key:`gateway`,label:`Gateway`},{key:`operations`,label:`Operations`},{key:`models`,label:`Models`},{key:`runtime`,label:`Runtime`},{key:`plugins`,label:`Plugins`},{key:`system`,label:`System`}],Zi=[{key:`chat`,label:`Chat`,path:`/ui/chat`,icon:`chat`,section:`gateway`},{key:`api-keys`,label:`App Keys`,path:`/ui/api-keys`,icon:`api-keys`,section:`gateway`,hideInModes:[`agent`]},{key:`audit`,label:`Audit`,path:`/ui/audit`,icon:`audit`,section:`gateway`,hideInModes:[`agent`]},{key:`dashboard`,label:`Dashboard`,path:`/`,icon:`dashboard`,section:`operations`},{key:`nodes`,label:`Nodes`,path:`/ui/nodes`,icon:`nodes`,section:`operations`,hideInModes:[`agent`]},{key:`controller-ops`,label:`Controller Ops`,path:`/ui/controller-ops`,icon:`controller`,section:`operations`,hideInModes:[`agent`]},{key:`gguf-library`,label:`GGUF Library`,path:`/ui/gguf-library`,icon:`library`,section:`models`},{key:`hf-downloads`,label:`HF Downloads`,path:`/ui/hf-downloads`,icon:`download`,section:`models`},{key:`hf-to-gguf`,label:`HF to GGUF`,path:`/ui/hf-to-gguf`,icon:`convert`,section:`models`},{key:`quantization`,label:`Quantization`,path:`/ui/quantization`,icon:`quantize`,section:`models`},{key:`benchmarks`,label:`Benchmarks`,path:`/ui/benchmarks`,icon:`benchmark`,section:`models`,hideInModes:[`agent`]},{key:`runtime-overview`,label:`Overview`,path:`/ui/runtime`,icon:`runtime`,section:`runtime`},{key:`tool-loop-evals`,label:`Tool Loop Evals`,path:`/ui/tool-loop-evals`,icon:`benchmark`,section:`runtime`},{key:`embeddings`,label:`Embeddings`,path:`/ui/embeddings`,icon:`embeddings`,section:`runtime`},{key:`plugins`,label:`Plugins`,path:`/ui/plugins`,icon:`plugins`,section:`plugins`,hideInModes:[`agent`]},{key:`setup`,label:`Setup`,path:`/ui/setup`,icon:`setup`,section:`system`},{key:`settings`,label:`Settings`,path:`/ui/settings`,icon:`settings`,section:`system`},{key:`docs`,label:`Docs`,path:`/ui/docs`,icon:`docs`,section:`system`}];function Qi(e){let t=e===`agent`||e===`controller`?e:``;return Zi.filter(e=>!t||!e.hideInModes?.includes(t))}function $i(e,t=[]){let n=[...Qi(e),...t];return Xi.map(e=>({...e,pages:n.filter(t=>t.section===e.key&&!t.hideFromPrimary)})).filter(e=>e.pages.length>0)}function ea(e,t=[]){return[...Zi,...t].find(t=>t.key===e)||Zi.find(e=>e.key===`dashboard`)||Zi[0]}function ta(e,t=[]){let n=[...Zi,...t].find(t=>t.path===e);if(n)return n;if(e.startsWith(`/ui/plugins/`)){let n=e.slice(12).split(`/`)[0];if(n)return t.find(t=>t.pluginId===n&&t.path===e)||{key:`plugin:${n}:${e}`,label:`Plugin`,path:e,icon:`settings`,section:`plugins`,pluginId:n,pluginName:`Plugin`,hideFromPrimary:!0}}return ea(`dashboard`)}function na(e,t={}){let n=t.search?.trim();return n?`${e.path}?${n.startsWith(`?`)?n.slice(1):n}`:e.path}function ra(e,t,n,r){let i=encodeURIComponent(t),a=`lines=${r}`;if(e===`download`)return{title:`download / ${t}`,streamPath:`/downloads/${i}/logs/stream?${a}`,fallbackPath:`/downloads/${i}/logs?${a}`,emptyText:`No download log output.`};if(e===`conversion`)return{title:`conversion / ${t}`,streamPath:`/conversions/${i}/logs/stream?${a}`,fallbackPath:`/conversions/${i}/logs?${a}`,emptyText:`No conversion log output.`};if(e===`quantization`)return{title:`quantization / ${t}`,streamPath:`/quantizations/${i}/logs/stream?${a}`,fallbackPath:`/quantizations/${i}/logs?${a}`,emptyText:`No quantization log output.`};if(e===`node-model`){let e=encodeURIComponent(n);return{title:`${n} / ${t}`,streamPath:`/nodes/${e}/logs/${i}/stream?${a}`,fallbackPath:`/nodes/${e}/logs/${i}?${a}`,emptyText:`No node log output.`}}return{title:`model / ${t}`,streamPath:`/logs/${i}/stream?${a}`,fallbackPath:`/logs/${i}?${a}`,emptyText:`No log output.`}}function ia(e){return e.split(`

`).map(e=>{let t=e.split(`
`);return{name:t.find(e=>e.startsWith(`event:`))?.slice(6).trim(),data:t.find(e=>e.startsWith(`data:`))?.slice(5).trim()}}).filter(e=>e.name===`chunk`&&e.data)}function aa({open:e,onClose:t,initialSelection:n}){let[r,i]=(0,v.useState)(`model`),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(200),[d,f]=(0,v.useState)(`Select a log source`),[p,m]=(0,v.useState)(`No logs loaded.`),[h,g]=(0,v.useState)(``),_=(0,v.useRef)(null),y=(0,v.useRef)(null),b=!!(n?.source&&n?.identifier);function x(){_.current?.abort(),_.current=null}(0,v.useEffect)(()=>()=>x(),[]),(0,v.useEffect)(()=>{if(!e||!n)return;let t=n.source,r=n.identifier,a=n.node||``,s=n.lines??200;i(t),o(r),c(a),u(s),n.autoLoad&&r.trim()&&queueMicrotask(()=>{S(t,r,a,s)})},[e,n]),(0,v.useEffect)(()=>{if(!e)return;let t=y.current;t&&(t.scrollTop=t.scrollHeight)},[e,p]);async function S(e=r,t=a,n=s,i=l){if(x(),g(``),!t.trim()){g(`Enter a log identifier.`);return}if(e===`node-model`&&!n.trim()){g(`Enter a node name.`);return}let o=ra(e,t.trim(),n.trim(),i);f(o.title),m(``);let c=new AbortController;_.current=c;try{let e=await ne(o.streamPath,{signal:c.signal}),t=new TextDecoder,n=``;for(;;){let{done:r,value:i}=await e.read();n+=t.decode(i||new Uint8Array,{stream:!r});let a=n.split(`

`);n=a.pop()||``;for(let e of ia(a.join(`

`)))try{let t=JSON.parse(e.data||`{}`);m(e=>`${e}${String(t.text||``)}`)}catch{m(t=>`${t}${e.data||``}`)}if(r)break}if(n.trim())for(let e of ia(n))try{let t=JSON.parse(e.data||`{}`);m(e=>`${e}${String(t.text||``)}`)}catch{m(t=>`${t}${e.data||``}`)}}catch(e){if(e instanceof DOMException&&e.name===`AbortError`||e instanceof Error&&e.name===`AbortError`)return;try{let e=await j(o.fallbackPath),t=e.result;m(String(e.text||t?.text||o.emptyText))}catch(e){m(o.emptyText),g(e instanceof Error?e.message:`Failed to load logs`)}}finally{_.current===c&&(_.current=null)}}function C(){x(),t()}return(0,R.jsxs)(me,{title:`Recent Logs`,open:e,onClose:C,children:[(0,R.jsxs)(`div`,{className:`log-modal-controls`,children:[b?null:(0,R.jsx)(B,{label:`Source`,children:(0,R.jsxs)(`select`,{value:r,onChange:e=>i(e.target.value),children:[(0,R.jsx)(`option`,{value:`model`,children:`Model`}),(0,R.jsx)(`option`,{value:`node-model`,children:`Node model`}),(0,R.jsx)(`option`,{value:`download`,children:`Download`}),(0,R.jsx)(`option`,{value:`conversion`,children:`Conversion`}),(0,R.jsx)(`option`,{value:`quantization`,children:`Quantization`})]})}),r===`node-model`?(0,R.jsx)(B,{label:`Node`,children:(0,R.jsx)(`input`,{value:s,onChange:e=>c(e.target.value),placeholder:`node name`})}):null,b?null:(0,R.jsx)(B,{label:`Identifier`,children:(0,R.jsx)(`input`,{value:a,onChange:e=>o(e.target.value),placeholder:`model, download id, or file id`})}),(0,R.jsx)(B,{label:`Lines`,children:(0,R.jsx)(`input`,{type:`number`,min:1,max:2e3,value:l,onChange:e=>u(Number(e.target.value))})}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>void S(),children:`Load Logs`}),(0,R.jsx)(z,{type:`button`,onClick:()=>m(``),"aria-label":`Clear displayed logs`,children:`Clear Display`}),(0,R.jsx)(z,{type:`button`,onClick:C,"aria-label":`Close logs`,children:`Close`})]}),(0,R.jsx)(`div`,{className:`muted`,children:d}),h?(0,R.jsx)(`p`,{className:`error-text`,role:`alert`,children:h}):null,(0,R.jsx)(`pre`,{ref:y,className:`modal-log-output`,children:p||`Waiting for log output...`})]})}function oa({icon:e}){return(0,R.jsxs)(`svg`,{className:`nav-icon icon-${e} ml-1`,viewBox:`0 0 24 24`,"aria-hidden":`true`,children:[e===`dashboard`?(0,R.jsx)(`path`,{d:`M4 12.5 12 5l8 7.5V20h-5v-5H9v5H4v-7.5Z`}):null,e===`setup`?(0,R.jsx)(`path`,{d:`M5 5h14v5H5V5Zm0 9h6v5H5v-5Zm9 0h5v5h-5v-5Z`}):null,e===`chat`?(0,R.jsx)(`path`,{d:`M5 6h14v9H9l-4 4V6Z`}):null,e===`nodes`?(0,R.jsx)(`path`,{d:`M6 7h5v5H6V7Zm7 5h5v5h-5v-5ZM7 14h3v3H7v-3Zm4-4h3m-4 6h3`}):null,e===`library`?(0,R.jsx)(`path`,{d:`M5 5h5v14H5V5Zm7 0h7v4h-7V5Zm0 6h7v8h-7v-8Z`}):null,e===`convert`?(0,R.jsx)(`path`,{d:`M6 8h10l-3-3m3 3-3 3M18 16H8l3 3m-3-3 3-3`}):null,e===`download`?(0,R.jsx)(`path`,{d:`M12 4v10m0 0 4-4m-4 4-4-4M5 18h14`}):null,e===`quantize`?(0,R.jsx)(`path`,{d:`M6 6h12v4H6V6Zm0 8h5v4H6v-4Zm7 0h5v4h-5v-4Z`}):null,e===`controller`?(0,R.jsx)(`path`,{d:`M5 7h14v10H5V7Zm4 3v4m3-4v4m3-4v4`}):null,e===`runtime`?(0,R.jsx)(`path`,{d:`M5 5h14v14H5V5Zm4 4h6M9 12h6M9 15h3`}):null,e===`embeddings`?(0,R.jsx)(`path`,{d:`M12 4v16M5 8l14 8M19 8 5 16`}):null,e===`audit`?(0,R.jsx)(`path`,{d:`M6 4h9l3 3v13H6V4Zm3 7h6M9 15h6`}):null,e===`benchmark`?(0,R.jsx)(`path`,{d:`M4 18h3v-6H4v6Zm6 0h3V8h-3v10Zm6 0h3V4h-3v14Z`}):null,e===`api-keys`?(0,R.jsx)(`path`,{d:`M7 11a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm4-6V3m0 16v-2m6-5h2M3 11h2m8.5-3.5 1.5-1.5M5 19l3-3m9 0 2 2M5 5l2 2`}):null,e===`plugins`?(0,R.jsx)(`path`,{d:`M8 4h8v5H8V4Zm-3 11h6v5H5v-5Zm8 0h6v5h-6v-5Zm-1-6v3m-4 0h8M8 12v3m8-3v3`}):null,e===`settings`?(0,R.jsx)(`path`,{d:`M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-4v3m0 10v3M4 12h3m10 0h3`}):null,e===`docs`?(0,R.jsx)(`path`,{d:`M7 4h10v16H7V4Zm3 4h4M10 10h4M10 14h2`}):null,e===`logs`?(0,R.jsx)(`path`,{d:`M5 5h14v14H5V5Zm4 5h6M9 14h4`}):null,e===`menu`?(0,R.jsx)(`path`,{d:`M5 7h14M5 12h14M5 17h14`}):null,e===`close`?(0,R.jsx)(`path`,{d:`M7 7l10 10M17 7 7 17`}):null]})}function sa(){return(0,R.jsxs)(`svg`,{className:`brand-logo`,viewBox:`0 0 64 64`,role:`img`,"aria-label":`Llama Pack logo`,children:[(0,R.jsx)(`path`,{className:`logo-chip`,d:`M17 14h26c7.2 0 13 5.8 13 13v20H30c-7.2 0-13-5.8-13-13V14Z`}),(0,R.jsx)(`path`,{className:`logo-neck`,d:`M9 43V18c0-4.4 3.6-8 8-8h4v33H9Z`}),(0,R.jsx)(`path`,{className:`logo-ear`,d:`M16 10 21 3l4 9`}),(0,R.jsx)(`path`,{className:`logo-face`,d:`M22 26h17c3.9 0 7 3.1 7 7v7H29c-3.9 0-7-3.1-7-7v-7Z`}),(0,R.jsx)(`path`,{className:`logo-line`,d:`M34 17v9M44 20v7M33 39h12`}),(0,R.jsx)(`circle`,{className:`logo-eye`,cx:`30`,cy:`31`,r:`2`})]})}function ca({activePage:e,onClose:t}){let{appMode:n,controllerUrl:r,controllerReachable:i,agentNodes:a}=Ci(),{pluginPages:o}=Ii(),{openLogs:s}=Ei(),c=$i(n,o);return(0,R.jsxs)(`aside`,{className:`app-sidebar`,"aria-label":`Primary`,children:[(0,R.jsxs)(`div`,{className:`brand-lockup`,children:[(0,R.jsx)(`div`,{className:`brand-mark`,"aria-hidden":`true`,children:(0,R.jsx)(sa,{})}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`h1`,{children:`Llama Pack`}),(0,R.jsx)(`p`,{children:n===`agent`?`Agent runtime`:n===`controller`?`Private AI gateway`:`Gateway console`})]})]}),(0,R.jsx)(`nav`,{className:`app-nav`,"aria-label":`Primary navigation`,children:c.map(e=>(0,R.jsxs)(`div`,{className:`nav-section`,children:[(0,R.jsx)(`div`,{className:`nav-section-label`,children:e.label}),e.pages.map(e=>(0,R.jsxs)(Yr,{to:e.path,className:({isActive:e})=>`nav-button cursor-pointer ${e?`active`:``}`,onClick:t,end:e.path===`/`,children:[(0,R.jsx)(oa,{icon:e.icon}),(0,R.jsx)(`span`,{children:e.navLabel||e.label})]},e.key)),e.key===`operations`?(0,R.jsxs)(`button`,{className:`nav-button modal-nav-button`,type:`button`,onClick:()=>{s(),t?.()},children:[(0,R.jsx)(oa,{icon:`logs`}),(0,R.jsx)(`span`,{children:`Logs`})]}):null]},e.key))}),(0,R.jsxs)(`div`,{className:`sidebar-footer`,children:[n===`agent`&&r?(0,R.jsxs)(`div`,{className:`sidebar-peers`,children:[(0,R.jsx)(`div`,{className:`sidebar-peers-label`,children:`Controller`}),(0,R.jsxs)(`a`,{className:`sidebar-peer-link`,href:r,target:`_blank`,rel:`noopener noreferrer`,title:r,children:[(0,R.jsx)(`span`,{className:`peer-status-dot ${i===!0?`online`:i===!1?`offline`:``}`,"aria-hidden":`true`}),(0,R.jsx)(oa,{icon:`controller`}),(0,R.jsx)(`span`,{className:`sidebar-peer-name`,children:r})]})]}):null,n===`controller`&&a.length>0?(0,R.jsxs)(`div`,{className:`sidebar-peers`,children:[(0,R.jsx)(`div`,{className:`sidebar-peers-label`,children:`Agent Nodes`}),a.map(e=>(0,R.jsxs)(`a`,{className:`sidebar-peer-link`,href:e.url,target:`_blank`,rel:`noopener noreferrer`,title:e.url,children:[(0,R.jsx)(`span`,{className:`peer-status-dot ${e.reachable?`online`:`offline`}`,"aria-hidden":`true`}),(0,R.jsx)(oa,{icon:`nodes`}),(0,R.jsx)(`span`,{className:`sidebar-peer-name`,children:e.name})]},e.name))]}):null]})]})}function la(){let{appMode:e,status:t,refreshKey:n,globalRefreshing:r,refreshGlobal:i}=Ci(),{pluginPages:a,pluginStatusIssues:o}=Ii(),{isOpen:s,selection:c,closeLogs:l}=Ei(),{authEnabled:u,setupStatusPending:d,isAuthenticated:f}=U(),p=xn(),m=wn(),[h,g]=(0,v.useState)(!1),_=ta(p.pathname,a),y=$i(e,a).flatMap(e=>e.pages);(0,v.useEffect)(()=>{g(!1)},[p.pathname]),(0,v.useEffect)(()=>(document.body.classList.toggle(`nav-open`,h),()=>document.body.classList.remove(`nav-open`)),[h]),(0,v.useEffect)(()=>{if(e&&!y.some(e=>e.key===_.key)){if(_.pluginId)return;_.key!==`dashboard`&&m(`/`,{replace:!0})}},[_.key,e,y,m]);let b=!d&&u===!0&&!f;return(0,R.jsx)(Ji,{appMode:e,children:(0,R.jsxs)(`div`,{className:`app-shell ${e}-mode ${h?`mobile-nav-open`:``}`,children:[(0,R.jsx)(ca,{activePage:_,onClose:()=>g(!1)}),(0,R.jsxs)(`div`,{className:`app-main`,children:[(0,R.jsxs)(`header`,{className:`app-header`,children:[(0,R.jsx)(`button`,{className:`mobile-menu-button`,type:`button`,"aria-label":h?`Close navigation menu`:`Open navigation menu`,"aria-expanded":h,onClick:()=>g(e=>!e),children:(0,R.jsx)(oa,{icon:h?`close`:`menu`})}),(0,R.jsxs)(`div`,{className:`command-center`,children:[(0,R.jsx)(`span`,{className:`command-icon`,"aria-hidden":`true`,children:(0,R.jsx)(sa,{})}),(0,R.jsx)(`span`,{className:`command-copy`,children:_.label})]}),(0,R.jsxs)(`div`,{className:`global-status`,children:[(0,R.jsx)(`span`,{className:`status-dot ${t===`Backend online`?`online`:t===`Backend offline`?`offline`:``}`,"aria-hidden":`true`}),(0,R.jsx)(`span`,{children:t}),(0,R.jsx)(z,{type:`button`,onClick:()=>void i(),disabled:r,"aria-label":r?`Refreshing`:`Global Refresh`,children:r?`Refreshing`:(0,R.jsx)(ze,{})})]}),(0,R.jsxs)(`div`,{className:`header-actions`,children:[(0,R.jsx)(ve,{}),(0,R.jsx)(Qe,{})]})]}),(0,R.jsxs)(`main`,{className:`layout`,children:[o.length?(0,R.jsxs)(`section`,{className:`plugin-status-alert`,role:`alert`,"aria-label":`Plugin status`,children:[(0,R.jsx)(`strong`,{children:`Plugin attention needed`}),(0,R.jsx)(`ul`,{children:o.map(e=>(0,R.jsx)(`li`,{children:e},e))})]}):null,b?(0,R.jsx)(V,{title:`Login Required`,eyebrow:`Session`,children:(0,R.jsx)(`p`,{className:`muted`,children:`Log in to Llama Pack to continue.`})}):null,_.pluginId&&_.secondaryNavigation?.length?(0,R.jsx)(`nav`,{className:`plugin-secondary-nav`,"aria-label":`${_.pluginName||_.label} navigation`,children:_.secondaryNavigation.map(e=>(0,R.jsx)(Yr,{to:e.path,className:({isActive:e})=>`plugin-secondary-button ${e?`active`:``}`,end:!0,children:e.label},e.path))}):null,d?(0,R.jsx)(`div`,{className:`muted`,"data-testid":`auth-gate-pending`,children:`Checking session...`}):(0,R.jsx)($n,{})]},`${_.key}-${n}`)]}),h?(0,R.jsx)(`button`,{className:`mobile-nav-scrim`,type:`button`,"aria-label":`Close navigation overlay`,onClick:()=>g(!1)}):null,(0,R.jsx)(aa,{open:s,onClose:l,initialSelection:c})]})})}function ua(e,t,n=[]){let[r,i]=(0,v.useState)(t),[a,o]=(0,v.useState)(!0),[s,c]=(0,v.useState)(``),l=(0,v.useCallback)(async()=>{o(!0),c(``);try{i(await e())}catch(e){c(e instanceof Error?e.message:`Request failed`)}finally{o(!1)}},n);return(0,v.useEffect)(()=>{l()},[l]),{data:r,loading:a,error:s,refresh:l,setError:c}}function da(){return j(`/library/ggufs`)}function fa(e,t){return M(`/library/ggufs/${encodeURIComponent(e)}/add-model`,t)}function pa(e,t){return P(`/library/models/${encodeURIComponent(e)}`,t)}function ma(e){return F(`/library/ggufs/${encodeURIComponent(e)}`)}function ha(e){return F(`/library/models/${encodeURIComponent(e)}`)}function ga(e,t){return M(`/nodes/${encodeURIComponent(e)}/transfers`,t)}function _a(){return j(`/models`)}function va(){return j(`/models/profiles`)}function ya(e){return M(`/models/${encodeURIComponent(e)}/start`)}function ba(e){return M(`/models/${encodeURIComponent(e)}/stop`)}function xa({name:e,statusLabel:t,badgeTone:n=`muted`,certLabel:r,certTone:i=`muted`,modelCount:a,onOpenNode:o,emptyMessage:s,children:c}){return(0,R.jsxs)(`article`,{className:`controller-node-card`,children:[(0,R.jsxs)(`div`,{className:`controller-node-card-header`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`label`,children:`Node`}),(0,R.jsx)(`strong`,{children:e})]}),(0,R.jsxs)(`div`,{className:`controller-node-card-badges`,children:[t?(0,R.jsx)(H,{tone:n,children:t}):null,r?(0,R.jsx)(H,{tone:i,children:r}):null]})]}),(0,R.jsxs)(`div`,{className:`node-model-summary`,children:[(0,R.jsxs)(`span`,{children:[a,` models`]}),o?(0,R.jsx)(z,{type:`button`,onClick:o,children:`Open Node`}):null]}),(0,R.jsxs)(`div`,{className:`node-model-cards`,children:[a===0?(0,R.jsx)(de,{message:s??`No models for this node.`}):null,c]})]})}function Sa(e){return!!(e.pid||e.running||e.status===`running`)}var Ca={DAY_SECONDS:1440*60,DAY_MS:1440*60*1e3,CERT_EXPIRING_SOON_SECONDS:720*60*60},wa={CHAT_PRESET_STORAGE_KEY:`lm_chat_preset`,ACTIVE_CHAT_SESSION_STORAGE_KEY:`lm_active_chat_session_id`,AUTH_TOKEN_STORAGE_KEY:`lm_ui_token`},Ta=[{value:``,label:`Auto / server default`},{value:`llama3`,label:`Llama 3`},{value:`llama-3`,label:`Llama 3 (alias)`},{value:`chatml`,label:`ChatML`},{value:`qwen`,label:`Qwen (ChatML)`},{value:`gemma`,label:`Gemma`},{value:`gpt-oss`,label:`GPT-OSS (ChatML)`},{value:`gptoss`,label:`GPTOSS (ChatML alias)`}];function W(e){return e.name||e.id||e.model||e.path||`unnamed model`}function Ea(e){let t=e.toLowerCase();return[`running`,`ready`,`available`,`loaded`,`reachable`].includes(t)?`success`:[`starting`,`stopping`,`loading`].includes(t)?`warning`:[`failed`,`error`,`offline`].includes(t)?`danger`:`muted`}function Da(e){return typeof e==`number`?`${Math.round(e)}%`:`-`}function Oa(e){return String(e.file_id||e.id||``)}function ka(e,t){let n=e.node||e.node_name;if(n)return n;let r=t.nodes.find(t=>t.models?.some(t=>W(t)===W(e)));return r?.name||r?.node_id||null}function Aa(e,t,n){let r=ja(e),i=W(t);return n.localModels.find(e=>{let t=e.node||e.node_name||ka(e,n);return(!t&&r===`controller-local`||t===r)&&W(e)===i})||{...t,node:r}}function ja(e){return String(e.name||e.node_id||``)}function Ma(e){return typeof e==`number`?e<=0?{tone:`danger`,label:`cert expired`}:e<=Ca.CERT_EXPIRING_SOON_SECONDS?{tone:`warning`,label:`cert ${Math.max(1,Math.ceil(e/Ca.DAY_SECONDS))}d left`}:{tone:`success`,label:`cert valid`}:{tone:`muted`,label:`cert unknown`}}function Na(e){return e.map(e=>({...e,name:ja(e)}))}function Pa(e,t,n){let r=e?.system,i=r?.[t];if(typeof i==`number`)return i;let a=r?.[n]?.percent;return typeof a==`number`?a:null}function Fa(e){return new Intl.NumberFormat(`en-US`).format(e)}function Ia(e){return typeof e!=`number`||!Number.isFinite(e)||e<=0?null:e>=1024**3?`${(e/1024**3).toFixed(1)} GB`:e>=1024**2?`${(e/1024**2).toFixed(1)} MB`:`${Fa(e)} B`}function La(e,t,n){return e[t]??e[n]??void 0}function Ra(e,t,n){let r=La(e,t,n);return typeof r==`number`?r:void 0}function za(e,t,n){let r=La(e,t,n);return typeof r==`string`?r:void 0}function Ba({model:e,resolvedNode:t,actingModel:n=``,onOpen:r,onStart:i,onStop:a,onChat:o,onBenchmark:s,onTransfer:c,onLogs:l,onAdd:u,onEdit:d,onDelete:f,children:p}){let m=e,h=W(e),g=Sa(e),_=za(m,`status`,`status`)||`available`,v=Ra(m,`port`,`model_port`),y=Ra(m,`pid`,`pid`),b=Ra(m,`ctx`,`model_ctx`),x=Ra(m,`gpu_layers`,`model_gpu_layers`),S=za(m,`host`,`host`),C=za(m,`reasoning`,`model_reasoning`),w=Ra(m,`reasoning_budget`,`model_reasoning_budget`),T=za(m,`prompt_template`,`model_prompt_template`),E=Ra(m,`size_bytes`,`size_bytes`),D=!!m.favorite,O=!!m.registered,k=za(m,`registered_as`,`registered_as`),A=za(m,`path`,`path`)||za(m,`model_path`,`model_path`)||``,ee=za(m,`model_dir`,`model_dir`)||``,j=!!(m.vision||m.supports?.vision),M=za(m,`file_id`,`file_id`)||za(m,`id`,`id`)||``,te=!!(i||a||o||s||c||l||u||d||f),N=[];if(v!==void 0&&N.push([`Port`,String(v)]),y!==void 0&&N.push([`PID`,String(y)]),b!==void 0&&N.push([`Context`,Fa(b)]),x!==void 0&&N.push([`GPU Layers`,String(x)]),S&&N.push([`Host`,S]),C&&N.push([`Reasoning`,w===void 0?C:`${C} / ${Fa(w)}`]),T&&N.push([`Template`,T]),E!==void 0){let e=Ia(E);e&&N.push([`Size`,e])}M&&N.push([`File ID`,M]),ee&&N.push([`Directory`,ee]),k&&N.push([`Added as`,k]);function P(){return te?(0,R.jsxs)(`div`,{className:`model-actions`,children:[u?(0,R.jsx)(z,{onClick:u,"aria-label":`Add ${h}`,children:`Add`}):null,d?(0,R.jsx)(z,{variant:`ghost`,onClick:d,"aria-label":`Edit ${h}`,children:`Edit`}):null,i?(0,R.jsx)(z,{variant:`success`,onClick:i,disabled:n===`start:${h}`,"aria-label":`Start ${h}`,children:(0,R.jsx)(Be,{})}):null,a?(0,R.jsx)(z,{variant:`danger`,onClick:a,disabled:n===`stop:${h}`,"aria-label":`Stop ${h}`,children:(0,R.jsx)(Fe,{})}):null,o?(0,R.jsx)(z,{variant:`warning`,onClick:o,"aria-label":`Chat with ${h}`,children:(0,R.jsx)(We,{})}):null,s?(0,R.jsx)(z,{type:`button`,onClick:s,"aria-label":`Benchmark ${h}`,children:(0,R.jsx)(Ie,{})}):null,c?(0,R.jsx)(z,{variant:`success`,onClick:c,"aria-label":`Send ${h}`,children:(0,R.jsx)(Re,{})}):null,l?(0,R.jsx)(z,{type:`button`,onClick:l,"aria-label":`View logs for ${h}`,children:(0,R.jsx)(Ne,{})}):null,f?(0,R.jsx)(z,{variant:`danger`,onClick:f,"aria-label":`Remove ${h}`,children:`Delete`}):null]}):null}return(0,R.jsxs)(`article`,{className:`library-card ${g?`active`:``}`.trim(),children:[r?(0,R.jsx)(`button`,{type:`button`,className:`library-card-button`,onClick:r,"aria-label":`Open ${h}`,children:(0,R.jsx)(`strong`,{children:h})}):(0,R.jsx)(`div`,{className:`library-card-button`,children:(0,R.jsx)(`strong`,{children:h})}),(0,R.jsxs)(`div`,{className:`library-card-badges`,children:[(0,R.jsxs)(H,{tone:Ea(_),children:[(0,R.jsx)(Ue,{}),` `,_]}),(0,R.jsxs)(H,{tone:`muted`,children:[(0,R.jsx)(He,{}),` `,t||(O?`local`:`discovered`)]}),D?(0,R.jsxs)(H,{tone:`warning`,children:[(0,R.jsx)(Le,{}),` favorite`]}):null,j?(0,R.jsx)(H,{tone:`muted`,children:`Vision`}):null]}),A||N.length>0?(0,R.jsxs)(`dl`,{className:`model-card-detail-grid`,children:[A?(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`Path`}),(0,R.jsx)(`dd`,{children:A})]}):null,N.map(([e,t])=>(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:e}),(0,R.jsx)(`dd`,{children:t})]},e))]}):null,p,P()]})}function Va(e=[]){let t=wn();return(0,v.useCallback)((n,r={})=>{t(na(ea(n,e),r))},[t,e])}function Ha(e){return[e.name,e.url,e.agent_config_source,e.controller_config_source].filter(Boolean).join(` `).toLowerCase()}function Ua(e,{query:t=``,status:n=``,registration:r=``}={}){let i=t.trim().toLowerCase();return e.filter(e=>{let t=!i||Ha(e).includes(i),a=!n||(n===`reachable`?!!e.reachable:!e.reachable),o=!r||e.registration===r;return t&&a&&o})}function Wa(e){let t=e.filter(e=>e.reachable).length,n=e.reduce((e,t)=>e+(Array.isArray(t.models)?t.models.length:0),0);return{reachable:t,total:e.length,models:n}}function Ga(e,t){let n=new Map;for(let t of Array.isArray(e)?e:[])t?.name&&n.set(t.name,{...t,reachable:!1,models:[]});for(let e of Array.isArray(t)?t:[])e?.name&&n.set(e.name,{...n.get(e.name)||{},...e});return Array.from(n.values()).sort((e,t)=>String(e.name).localeCompare(String(t.name)))}function Ka(e){return String(e?.name||e?.model_dir||``).trim()}function qa(e){let t=[e?.name,e?.model_dir,e?.filename,e?.path].filter(Boolean).join(` `).toLowerCase();return t.includes(`gpt-oss`)?`gpt-oss`:t.includes(`llama-3`)||t.includes(`llama3`)?`llama3`:t.includes(`gemma`)?`gemma`:t.includes(`qwen`)?`qwen`:t.includes(`chatml`)?`chatml`:``}function Ja(e){return[...Array.isArray(e)?e:[]].sort((e,t)=>{let n=Number(!!t?.favorite)-Number(!!e?.favorite);return n===0?String(e?.name||``).localeCompare(String(t?.name||``)):n})}function Ya(e){return{name:String(e?.name||``),url:String(e?.url||``),api_key:``,verify_tls:e?.verify_tls??!0}}function Xa(e,t){return(Array.isArray(e)?e:[]).filter(e=>e?.name&&e.name!==t&&!!e.reachable).sort((e,t)=>String(e.name).localeCompare(String(t.name)))}function Za(e){return e?.recently_received?e.received_from_node?`Received from ${e.received_from_node}`:`Recently received`:``}function Qa(e,t,n,r){let i=new URLSearchParams;return i.set(`model`,e),i.set(`target`,t||`auto`),n&&i.set(`target_node`,n),i.set(`source`,r),i.toString()}function $a(e=window.location.search){let t=new URLSearchParams(e);return{model:t.get(`model`)?.trim()||``,target:t.get(`target`)?.trim()||``,targetNode:t.get(`target_node`)?.trim()||``,source:t.get(`source`)?.trim()||``}}var eo=[{value:`selected_with_sidecars`,label:`Selected + sidecars`},{value:`selected_only`,label:`Selected only`}];function to(e){let t=String(e||``).toLowerCase();return[`succeeded`,`complete`,`completed`].includes(t)?`success`:[`failed`,`error`,`cancelled`,`canceled`].includes(t)?`danger`:[`running`,`queued`,`pending`].includes(t)?`warning`:`muted`}function no({transfer:e,destinationOptions:t,onClose:n,onChangeDestination:r,onChangeInclude:i,onSubmit:a,progressText:o,progressErrorDetail:s,includeOptions:c=eo}){return(0,R.jsx)(me,{title:e?`Send ${e.modelName}`:`Send Model`,open:!!e,onClose:n,children:e?(0,R.jsxs)(`div`,{className:`library-detail`,children:[(0,R.jsxs)(`dl`,{className:`detail-list`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`Source`}),(0,R.jsx)(`dd`,{children:e.sourceNode})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`File ID`}),(0,R.jsx)(`dd`,{children:e.sourceFileId})]})]}),(0,R.jsxs)(`div`,{className:`library-controls`,children:[(0,R.jsx)(B,{label:`Destination node`,children:(0,R.jsxs)(`select`,{value:e.destinationNode,onChange:e=>r(e.target.value),children:[(0,R.jsx)(`option`,{value:``,children:`Select destination`}),t.map(e=>(0,R.jsx)(`option`,{value:e.name,children:e.name},e.name))]})}),c.length>1&&i?(0,R.jsx)(B,{label:`Include files`,children:(0,R.jsx)(`select`,{value:e.include,onChange:e=>i(e.target.value),children:c.map(e=>(0,R.jsx)(`option`,{value:e.value,children:e.label},e.value))})}):null]}),e.status?(0,R.jsxs)(`div`,{className:`transfer-status`,children:[(0,R.jsx)(H,{tone:to(e.status.status),children:String(e.status.status||`queued`)}),(0,R.jsxs)(`span`,{className:`muted`,children:[String(e.status.source_node||e.sourceNode),` to`,` `,String(e.status.destination_node||e.destinationNode)]}),o?(0,R.jsx)(`span`,{className:`muted`,children:o}):null,s?(0,R.jsx)(`span`,{className:`muted`,children:s}):null]}):null,(0,R.jsx)(`div`,{className:`modal-actions`,children:(0,R.jsx)(z,{type:`button`,onClick:a,disabled:!e.destinationNode||e.destinationNode===e.sourceNode||e.submitting,children:e.submitting?`Sending`:`Send Model`})})]}):null})}var ro={health:null,localModels:[],nodes:[]};function io(){return w()}function ao(e,t,n,r){let i=new URLSearchParams;return i.set(`model`,e),i.set(`target`,t),i.set(`mode`,n),i.set(`source`,r),i.toString()}function oo(){let{openLogs:e}=Ei(),t=Va(),{data:n,loading:r,error:i,refresh:a,setError:o}=ua(io,ro),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(null);async function d(e,t){let r=W(e),i=ka(e,n);c(`${t}:${r}`),o(``);try{i?(t===`start`&&await gi(i,r),t===`stop`&&await _i(i,r)):(t===`start`&&await ya(r),t===`stop`&&await ba(r)),await a()}catch(e){o(e instanceof Error?e.message:`Failed to ${t} ${r}`)}finally{c(``)}}function f(e){let t=W(e),r=ka(e,n)||``,i=Xa(Na(n.nodes),r);u({sourceNode:r,modelName:t,sourceFileId:Oa(e),destinationNode:String(i[0]?.name||``),include:`selected_with_sidecars`,status:null,submitting:!1})}async function p(){if(!(!l?.sourceNode||!l.destinationNode||!l.sourceFileId||l.sourceNode===l.destinationNode)){o(``),u({...l,submitting:!0});try{let e=await ga(l.sourceNode,{destination_node:l.destinationNode,source_file_id:l.sourceFileId,include:l.include});u(t=>t&&{...t,status:e,submitting:!1})}catch(e){o(e instanceof Error?e.message:`Failed to start transfer`),u(e=>e&&{...e,submitting:!1})}}}let m=n.health?.mode||`unknown`,h=m===`controller`,g=Na(n.nodes),_=(()=>{let e=new Map;for(let t of n.nodes)e.set(ja(t)||`unnamed node`,t);for(let t of n.localModels){let n=t.node||t.node_name||`controller-local`,r=e.get(n),i=r?.models||[];i.some(e=>W(e)===W(t))||e.set(n,{...r||{name:n,reachable:!0,status:n===`controller-local`?`local`:`reachable`},models:[...i,t]})}return[...e.values()]})(),y=_.filter(e=>typeof e.cert_expires_in_seconds==`number`&&e.cert_expires_in_seconds<=0).map(e=>ja(e)||`unnamed node`),b=_.filter(e=>{let t=e.cert_expires_in_seconds;return typeof t==`number`&&t>0&&t<=Ca.CERT_EXPIRING_SOON_SECONDS}).map(e=>{let t=Number(e.cert_expires_in_seconds);return`${ja(e)||`unnamed node`} (${Math.max(1,Math.ceil(t/Ca.DAY_SECONDS))}d)`});function x(r,i){let a=W(r),o=ka(r,n);return(0,R.jsx)(Ba,{model:r,resolvedNode:o,actingModel:s,onOpen:()=>t(`gguf-library`),onStart:()=>void d(r,`start`),onStop:()=>void d(r,`stop`),onChat:()=>t(`chat`,{search:ao(a,o?`node:${o}`:`auto`,o?`thread`:`direct`,`dashboard`)}),onBenchmark:()=>t(`benchmarks`,{search:Qa(a,o?`node:${o}`:`auto`,o||``,`dashboard`)}),onTransfer:()=>f(r),onLogs:()=>e({source:o?`node-model`:`model`,identifier:a,node:o||void 0,autoLoad:!0})},i)}return(0,R.jsxs)(`div`,{className:`dashboard-page`,children:[(0,R.jsxs)(V,{className:`health-panel dashboard-health`,eyebrow:`Live Health`,title:`System Snapshot`,actions:(0,R.jsx)(z,{type:`button`,onClick:a,disabled:r,children:r?`Refreshing`:`Refresh`}),children:[(0,R.jsx)(pe,{message:i}),(0,R.jsxs)(`div`,{className:`metric-grid`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`label`,children:`Mode`}),(0,R.jsx)(`strong`,{children:m})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`label`,children:`CPU`}),(0,R.jsx)(`strong`,{children:Da(Pa(n.health,`cpu_percent`,`cpu`))})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`label`,children:`RAM`}),(0,R.jsx)(`strong`,{children:Da(Pa(n.health,`memory_percent`,`ram`))})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`label`,children:`VRAM`}),(0,R.jsx)(`strong`,{children:Da(Pa(n.health,`vram_percent`,`vram`))})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`label`,children:`Configured`}),(0,R.jsx)(`strong`,{children:n.health?.configured_models??n.health?.models_configured??n.localModels.length})]})]})]}),h&&(y.length>0||b.length>0)?(0,R.jsxs)(V,{className:`dashboard-cert-alerts`,eyebrow:`TLS Alerts`,title:`Node Certificates`,children:[y.length>0?(0,R.jsxs)(`p`,{className:`dashboard-cert-alert dashboard-cert-alert-danger`,role:`alert`,children:[(0,R.jsx)(`strong`,{children:`Expired:`}),` `,y.join(`, `)]}):null,b.length>0?(0,R.jsxs)(`p`,{className:`dashboard-cert-alert dashboard-cert-alert-warning`,children:[(0,R.jsx)(`strong`,{children:`Expiring soon:`}),` `,b.join(`, `)]}):null]}):null,m===`agent`?(0,R.jsx)(V,{className:`dashboard-models`,eyebrow:`This agent`,title:`Local Models`,actions:(0,R.jsx)(z,{type:`button`,onClick:()=>t(`gguf-library`),children:`Add Model`}),children:(0,R.jsxs)(`div`,{className:`library-cards`,children:[n.localModels.length===0?(0,R.jsx)(de,{message:`No local models reported.`}):null,n.localModels.map((e,t)=>x(e,`${W(e)}-${t}`))]})}):(0,R.jsx)(V,{className:`dashboard-controller-nodes`,eyebrow:`Controller view`,title:`All Nodes`,actions:(0,R.jsx)(z,{type:`button`,onClick:()=>t(`nodes`),children:`Manage Nodes`}),children:(0,R.jsxs)(`div`,{className:`controller-node-grid`,children:[_.length===0?(0,R.jsx)(de,{message:`No controller nodes reported.`}):null,_.map((e,r)=>{let i=ja(e)||`unnamed node`,a=e.models||[],o=e.reachable===!1?`offline`:e.status||`reachable`,s=e.reachable===!1?`danger`:Ea(e.status||`reachable`),c=Ma(e.cert_expires_in_seconds);return(0,R.jsx)(xa,{name:i,statusLabel:o,badgeTone:s,certLabel:c.label,certTone:c.tone,modelCount:a.length,onOpenNode:()=>t(`nodes`),emptyMessage:`No models reported for this node.`,children:a.map((t,r)=>x(Aa(e,t,n),`${i}-${W(t)}-${r}`))},`${i}-${r}`)})]})}),(0,R.jsx)(no,{transfer:l,destinationOptions:Xa(g,l?.sourceNode||``),onClose:()=>u(null),onChangeDestination:e=>u(t=>t&&{...t,destinationNode:e}),onChangeInclude:e=>u(t=>t&&{...t,include:e}),onSubmit:()=>void p()}),(0,R.jsx)(V,{className:`quick-actions-panel`,eyebrow:`Shortcuts`,title:`Quick Actions`,children:(0,R.jsxs)(`div`,{className:`quick-actions`,children:[(0,R.jsxs)(`button`,{type:`button`,className:`quick-action`,onClick:()=>t(`chat`),children:[(0,R.jsx)(`strong`,{children:`Open Chat`}),(0,R.jsx)(`small`,{children:`Smoke test a route`})]}),(0,R.jsxs)(`button`,{type:`button`,className:`quick-action`,onClick:()=>t(`quantization`),children:[(0,R.jsx)(`strong`,{children:`Quantize`}),(0,R.jsx)(`small`,{children:`Fit a model to VRAM`})]}),h&&(0,R.jsxs)(`button`,{type:`button`,className:`quick-action`,onClick:()=>t(`controller-ops`),children:[(0,R.jsx)(`strong`,{children:`Controller`}),(0,R.jsx)(`small`,{children:`Jobs and nodes`})]})]})})]})}function so(e){return j(`/chat/capabilities/${encodeURIComponent(e)}`)}function G(e,t){return M(`/chat/${encodeURIComponent(e)}/inspect`,t)}function co(e,t=`auto`){return j(`/chat/${encodeURIComponent(e)}/kv/slots?target=${encodeURIComponent(t)}`)}function lo(e,t,n=`auto`){return M(`/chat/${encodeURIComponent(e)}/kv/slots/${t}`,{action:`clear`,target:n})}function uo(e,t){return M(`/chat/${encodeURIComponent(e)}`,t)}function fo(e,t){return te(`/v1/chat/completions`,e,{signal:t})}function po(){return j(`/chat/sessions`)}function mo(e){return j(`/chat/sessions/${encodeURIComponent(e)}`)}function ho(e){return M(`/chat/sessions`,e)}function go(e){return F(`/chat/sessions/${encodeURIComponent(e)}`)}function _o(e){return M(`/threads`,e)}function vo(e,t=``){return j(`/threads/${encodeURIComponent(e)}/events${t}`)}function yo(e,t){return M(`/threads/${encodeURIComponent(e)}/messages`,t)}function bo({name:e,model:t,target:n=`auto`,messages:r=[],requestDefaults:i={},selectedSessionId:a=``,saveAsNew:o=!1}={}){let s={name:e,model:t,target:n,messages:r,request_defaults:i},c=typeof a==`string`?a.trim():``;return!o&&c&&(s.id=c),s}function xo({savedSessionId:e}={}){return typeof e==`string`&&e.trim()||``}var So=1440*60*1e3;function Co(e){if(typeof e!=`string`||!e.trim())return null;let t=Date.parse(e);return Number.isFinite(t)?t:null}function wo(e,t=Date.now()){let n=Co(e?.updated_at);return n==null?!1:t-n<So}function To({sessions:e=[],preferredSessionId:t=``,nowMs:n=Date.now()}={}){let r=typeof t==`string`?t.trim():``,i=r?e.find(e=>e?.id===r):null;if(i&&wo(i,n))return i.id||``;let a=e.find(e=>wo(e,n));return typeof a?.id==`string`?a.id:``}function Eo(e){return typeof e!=`number`||Number.isNaN(e)?null:e}function Do(e,t){let n=e?.usage||{},r=e?.timings||{},i=Eo(n.prompt_tokens),a=Eo(n.completion_tokens),o=Eo(r.prompt_ms),s=Eo(r.predicted_ms),c=Eo(r.predicted_n),l=s??Eo(n.completion_time_ms),u=c??a,d=l&&u&&l>0?u*1e3/l:null;t.telemetry={...t.telemetry||{},...i==null?{}:{promptTokens:i},...a==null?{}:{completionTokens:a},...o==null?{}:{promptMs:o},...l==null?{}:{completionMs:l},...d==null?{}:{tokensPerSecond:d}}}function Oo(e,t){let n=typeof t==`number`?t:performance.now(),r=e.startedAtMs||n,i=n-r,a=!!(e.content||e.reasoningContent),o=e.firstTokenAtMs?e.firstTokenAtMs-r:a?i:null;e.telemetry={...e.telemetry||{},...o==null?{}:{ttftMs:o},totalMs:i}}function ko(e){let t=e?.content||{},n=typeof t.text==`string`?t.text:``,r=e?.route||{};return e?.event_type===`user_message`?{role:`user`,content:n,threadEventType:e.event_type}:e?.event_type===`assistant_message`?{role:`assistant`,content:n,threadEventType:e.event_type,routeMeta:{model:e.model||String(r.model||``),target:e.agent_node?`node:${e.agent_node}`:``,resolved:e.agent_node||String(r.node||``),reason:String(r.reason||``)}}:e?.event_type===`routing_decision`?{role:`internal`,content:No(e),threadEventType:e.event_type,routeMeta:{model:e.model||String(r.model||``),target:e.agent_node?`node:${e.agent_node}`:``,resolved:e.agent_node||String(r.node||``),reason:String(r.reason||``)}}:e?.event_type===`error`?{role:`error`,content:e.error_detail||n||`Thread request failed`,threadEventType:e.event_type}:{role:e?.public===!1?`internal`:e?.role||`assistant`,content:n||JSON.stringify(t,null,2),threadEventType:e?.event_type||`event`}}function Ao(e=[]){return e.map(ko)}function jo({app:e,purpose:t,priority:n,requestType:r}){return{app:Mo(e),purpose:Mo(t),priority:n||`medium`,request_type:r||`general`}}function Mo(e){return String(e||``).trim()||null}function No(e){let t=e.route||{},n=e.content||{},r=n.candidates,i=[t.node||n.node?`node=${String(t.node||n.node)}`:null,t.model||n.model?`model=${String(t.model||n.model)}`:null,t.reason||n.reason?`reason=${String(t.reason||n.reason)}`:null,Array.isArray(r)?`candidates=${r.length}`:null].filter(Boolean);return i.length?`routing_decision ${i.join(` `)}`:`routing_decision`}function Po(e){return e.split(`
`).map(e=>e.trim()).filter(e=>e.startsWith(`data:`)).map(e=>e.slice(5).trim()).filter(Boolean)}async function Fo(e,t){let n=new TextDecoder,r=``;function i(e){if(e!==`[DONE]`)try{let n=JSON.parse(e);if(n.type===`route`){t.onRoute?.(n);return}if(n.type===`error`){t.onError?.(n);return}let r=(Array.isArray(n.choices)?n.choices:[])[0]?.delta||{},i=String(r.content||``),a=String(r.reasoning_content||r.reasoning||``);(i||a)&&t.onDelta?.({content:i,reasoning:a})}catch{}}for(;;){let{done:t,value:a}=await e.read();r+=n.decode(a||new Uint8Array,{stream:!t});let o=r.split(`

`);r=o.pop()||``;for(let e of o)for(let t of Po(e))i(t);if(t){if(r.trim())for(let e of Po(r))i(e);break}}}function Io(e){return Array.isArray(e)?e:e?.models||[]}function Lo(e){return Array.isArray(e)?e:e?.nodes||[]}function Ro(e){return e.flatMap(e=>{let t=String(e.name||``);return!t||e.reachable===!1||!Array.isArray(e.models)?[]:e.models.map(e=>({...e,name:W(e),node:t}))}).filter(e=>W(e))}function zo(e){return e.node||e.node_name?`node:${e.node||e.node_name}`:``}function Bo(e){let t=W(e),n=zo(e);return n?`${t} on ${n.slice(5)}`:t}function Vo(e){let t=String(e.status||``).toLowerCase();return!t||t===`running`||t===`loaded`}function Ho(e){return!!(e?.vision||e?.supports?.vision)}function Uo(e){return new Promise((t,n)=>{let r=new FileReader;r.onload=()=>t(String(r.result||``)),r.onerror=()=>n(r.error||Error(`Failed to read image`)),r.readAsDataURL(e)})}function Wo(e){let t=e.telemetry||{};return[t.tokensPerSecond==null?null:`tok/s: ${t.tokensPerSecond.toFixed(2)}`,t.ttftMs==null?null:`ttft: ${t.ttftMs.toFixed(0)}ms`,t.totalMs==null?null:`total: ${t.totalMs.toFixed(0)}ms`,t.promptTokens==null?null:`prompt_toks: ${t.promptTokens}`,t.completionTokens==null?null:`gen_toks: ${t.completionTokens}`].filter(Boolean)}function Go(e){let t=(Array.isArray(e.choices)?e.choices:[])[0];return t?.message?.content||t?.text||``}function Ko(e){return Array.isArray(e)?e:e?.sessions||[]}function qo(e){let t=e?.families;return{families:Array.isArray(t)?t:[]}}function Jo(e,t){return e.families.find(e=>e.family===t)?.profiles[0]?.profile||``}function Yo(e,t){return t&&e.families.find(e=>e.family===t)?.family||``}function Xo(){let e=new URLSearchParams(window.location.search),t=e.get(`model`)?.trim()||``,n=e.get(`target`)?.trim()||``,r=e.get(`mode`)?.trim()||``,i=e.get(`source`)?.trim()||``;return{model:t,target:n,chatMode:r===`thread`?`thread`:r===`direct`?`direct`:``,source:i}}function Zo(e){let t=e;return t.name||[t.model,t.updated_at].filter(Boolean).join(` - `)||t.id||`Untitled session`}function Qo(e){return(e?.messages||[]).filter(e=>typeof e.role==`string`&&typeof e.content==`string`).map(e=>{let t={role:String(e.role),content:String(e.content)};return typeof e.route==`string`&&(t.route=e.route),typeof e.threadEventType==`string`&&(t.threadEventType=e.threadEventType),typeof e.thread_event_type==`string`&&(t.threadEventType=e.thread_event_type),typeof e.reasoningContent==`string`&&(t.reasoningContent=e.reasoningContent),typeof e.reasoning_content==`string`&&(t.reasoningContent=e.reasoning_content),typeof e.stopped==`boolean`&&(t.stopped=e.stopped),e.routeMeta&&typeof e.routeMeta==`object`&&(t.routeMeta=e.routeMeta),e.route_meta&&typeof e.route_meta==`object`&&(t.routeMeta=e.route_meta),e.telemetry&&typeof e.telemetry==`object`&&(t.telemetry=e.telemetry),t})}function $o(e){let t=e.split(`,`).map(e=>e.trim()).filter(Boolean);if(t.length)return t.length===1?t[0]:t}function es(e){let t=e instanceof Error?e.message:`Chat request failed`;return t.includes(`401 Unauthorized`)?`Unauthorized. Log in with a valid API key in the header bar, then retry.`:t}function ts(e){if(e.structuredMode===`none`)return{payload:{}};if(e.structuredMode===`json_schema`){if(!e.jsonSchemaText.trim())return{error:`Structured mode is JSON Schema but schema is empty.`};try{return{payload:{json_schema:JSON.parse(e.jsonSchemaText)}}}catch{return{error:`JSON schema is not valid JSON.`}}}return e.grammarText.trim()?{payload:{grammar:e.grammarText.trim()}}:{error:`Structured mode is Grammar but grammar is empty.`}}async function ns(e,t){let n=new TextDecoder,r=``;for(;;){let{done:i,value:a}=await e.read();r+=n.decode(a||new Uint8Array,{stream:!i});let o=r.split(`

`);r=o.pop()||``;for(let e of o)for(let n of Po(e))if(n!==`[DONE]`)try{let e=JSON.parse(n),r=e.choices?.[0]||{};t(r.delta?.content||r.text||``,e,r.delta?.reasoning_content||r.delta?.reasoning||``)}catch{t(n)}if(i){if(r.trim())for(let e of Po(r))e!==`[DONE]`&&t(e);break}}}var rs={balanced:{temperature:.7,max_tokens:1024,top_p:1},precise:{temperature:.2,max_tokens:768,top_p:.9},creative:{temperature:.95,max_tokens:2048,top_p:.95}},is={top_k:40,min_p:0,repeat_penalty:1.1,seed:-1,stop:``,reasoning:!1,cache_prompt:!1,slot_id:``,structuredMode:`none`,jsonSchemaText:``,grammarText:``};function as(){let[e]=(0,v.useState)(Xo),[t,n]=(0,v.useState)([]),[r,i]=(0,v.useState)({families:[]}),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(e.model),[d,f]=(0,v.useState)(e.target||`auto`),[p,m]=(0,v.useState)(e.chatMode||`direct`),[h,g]=(0,v.useState)(``),[_,y]=(0,v.useState)(e.source||`ui`),[b,x]=(0,v.useState)(`chat`),[S,C]=(0,v.useState)(`medium`),[w,T]=(0,v.useState)(`general`),[E,D]=(0,v.useState)(!1),[O,k]=(0,v.useState)(!1),[A,ee]=(0,v.useState)(!1),[j,M]=(0,v.useState)(`No thread created.`),[te,N]=(0,v.useState)(``),[P,F]=(0,v.useState)(null),[ne,re]=(0,v.useState)([]),[ie,I]=(0,v.useState)(`Ready`),[ae,L]=(0,v.useState)(``),[oe,se]=(0,v.useState)(!1),[ce,le]=(0,v.useState)(``),[ue,fe]=(0,v.useState)(()=>localStorage.getItem(wa.CHAT_PRESET_STORAGE_KEY)||`balanced`),[me,he]=(0,v.useState)(()=>rs[localStorage.getItem(wa.CHAT_PRESET_STORAGE_KEY)||`balanced`]||rs.balanced),[ge,_e]=(0,v.useState)(!1),[U,ve]=(0,v.useState)(is),[ye,be]=(0,v.useState)(null),[xe,Se]=(0,v.useState)(`Capabilities unavailable.`),[Ce,we]=(0,v.useState)(`No prompt inspection yet.`),[Te,Ee]=(0,v.useState)(`No KV slot data loaded.`),[De,Oe]=(0,v.useState)(``),[ke,Ae]=(0,v.useState)([]),[je,Me]=(0,v.useState)(()=>localStorage.getItem(wa.ACTIVE_CHAT_SESSION_STORAGE_KEY)||``),[Ne,Pe]=(0,v.useState)(``),Fe=(0,v.useRef)(null);async function Ie(){L(``);try{let e=Io(await _a());e.length||(e=Ro(Lo(await mi())));let t=e.filter(e=>W(e)&&Vo(e));n(e),u(e=>t.some(t=>W(t)===e)?e:W(t[0]||{})),f(e=>e===`auto`&&zo(t[0]||{})?zo(t[0]||{}):e)}catch(e){L(e instanceof Error?e.message:`Failed to load chat models`)}}async function Le(){try{let e=qo(await va());i(e);let t=Yo(e,l)||e.families[0]?.family||``;o(e=>e||t),c(n=>n||Jo(e,t))}catch{i({families:[]})}}function Re(e){u(e);let t=Yo(r,e);t&&(o(t),c(Jo(r,t)))}(0,v.useEffect)(()=>{Ie();let e=window.setTimeout(()=>void Le(),300);return()=>{window.clearTimeout(e),Fe.current?.abort()}},[]);function ze(e,t){ve(n=>({...n,[e]:t}))}async function Be(e=l){if(e)try{let t=await so(e);be(t),Se(JSON.stringify(t,null,2))}catch(e){be(null),Se(e instanceof Error?e.message:`Capabilities unavailable.`)}}function Ve(){_e(e=>{let t=!e;return t&&Be(),t})}function He(e){fe(e),localStorage.setItem(wa.CHAT_PRESET_STORAGE_KEY,e),he(rs[e]||rs.balanced)}function Ue(e,t){re(n=>n.map((n,r)=>r===e?{...n,...t}:n))}function We(e,t,n,r=``){re(i=>i.map((i,a)=>{if(a!==e)return i;let o={...i,content:`${i.content}${t}`,reasoningContent:`${i.reasoningContent||``}${r}`};return!o.firstTokenAtMs&&(t||r)&&(o.firstTokenAtMs=performance.now()),n&&Do(n,o),o}))}function Ge(e){let t=ts(U);if(t.error)return{error:t.error};let n={messages:e.filter(e=>e.role!==`error`&&!e.pending).map(e=>({role:e.role,content:e.requestContent||e.content})),...me,target:d,top_k:U.top_k,min_p:U.min_p,repeat_penalty:U.repeat_penalty,seed:U.seed,reasoning:U.reasoning,cache_prompt:U.cache_prompt,...a&&s?{model_family:a,context_profile:s}:{},...t.payload||{}},r=$o(U.stop);r&&(n.stop=r);let i=U.slot_id.trim();return i&&(n.slot_id=Number(i)),{payload:n}}async function Ke(){ye&&(await window.navigator.clipboard?.writeText(JSON.stringify(ye,null,2)),I(`Capabilities copied`))}async function qe(){if(!l)return;let e=Ge(te.trim()?[{role:`user`,content:te.trim()}]:[{role:`user`,content:``}]);if(e.error){L(e.error);return}let t=await G(l,e.payload||{});we(String(t.rendered_prompt_preview||JSON.stringify(t,null,2)))}async function Je(){if(!l)return;let e=await co(l,d);Ee(JSON.stringify(e,null,2))}async function Ye(){if(!l||!De.trim())return;let e=await lo(l,Number(De),d);Ee(JSON.stringify(e,null,2))}async function Xe(){L(``);try{let e=Ko(await po());return Ae(e),Me(t=>t||localStorage.getItem(wa.ACTIVE_CHAT_SESSION_STORAGE_KEY)||e[0]?.id||``),I(`Sessions refreshed`),e}catch(e){return L(e instanceof Error?e.message:`Failed to load chat sessions`),[]}}function Ze(e){let t=String(e.id||``),n=typeof e.model==`string`?e.model:``,r=typeof e.target_selector==`string`?e.target_selector:`auto`,i=e.request_defaults||{};n&&u(n),f(r||`auto`),he(e=>({...e,...typeof i.temperature==`number`?{temperature:i.temperature}:{},...typeof i.max_tokens==`number`?{max_tokens:i.max_tokens}:{},...typeof i.top_p==`number`?{top_p:i.top_p}:{}})),i.advanced&&typeof i.advanced==`object`&&ve(e=>({...e,...i.advanced})),(i.chat_mode===`direct`||i.chat_mode===`thread`)&&m(i.chat_mode),typeof i.model_family==`string`&&o(i.model_family),typeof i.context_profile==`string`&&c(i.context_profile),typeof i.thread_id==`string`&&g(i.thread_id),typeof i.include_internal==`boolean`&&D(i.include_internal);let a=i.thread_metadata;a&&typeof a==`object`&&(y(String(a.app||`ui`)),x(String(a.purpose||`chat`)),C(a.priority||`medium`),T(a.request_type||`general`)),re(Qo(e)),Pe(String(e.name||``)),le(``),t&&(Me(t),localStorage.setItem(wa.ACTIVE_CHAT_SESSION_STORAGE_KEY,t)),I(`Session loaded`)}async function Qe(e=je){let t=e.trim();if(t){L(``);try{Ze(await mo(t))}catch(e){L(e instanceof Error?e.message:`Failed to load chat session`)}}}async function $e(e=!1){L(``);try{let t=bo({name:Ne.trim()||`Chat ${new Date().toLocaleString()}`,model:l,target:d,messages:ne.filter(e=>!e.pending).map(at),requestDefaults:it(),selectedSessionId:je,saveAsNew:e}),n=await ho(t),r=xo({savedSessionId:String(n.id||``),saveAsNew:e});r&&(Me(r),localStorage.setItem(wa.ACTIVE_CHAT_SESSION_STORAGE_KEY,r)),Pe(String(n.name||t.name||``)),Ae(e=>{let t=n;return e.some(e=>e.id===t.id)?e.map(e=>e.id===t.id?t:e):[t,...e]}),I(`Session saved`)}catch(e){L(e instanceof Error?e.message:`Failed to save chat session`)}}async function et(){let e=je.trim();if(e){L(``);try{await go(e),Ae(t=>t.filter(t=>t.id!==e)),Me(``),localStorage.setItem(wa.ACTIVE_CHAT_SESSION_STORAGE_KEY,``),I(`Session deleted`)}catch(e){L(e instanceof Error?e.message:`Failed to delete chat session`)}}}async function tt(){let e=To({sessions:await Xe(),preferredSessionId:localStorage.getItem(wa.ACTIVE_CHAT_SESSION_STORAGE_KEY)||je});if(!e){I(`No reusable session`);return}await Qe(e)}function nt(e){re(t=>t.map((t,n)=>{if(n!==e)return t;let r={...t};return Oo(r),r}))}function rt(){return jo({app:_,purpose:b,priority:S,requestType:w})}function it(){return{...me,advanced:U,chat_mode:p,thread_id:h,thread_metadata:rt(),include_internal:E,model_family:a||void 0,context_profile:s||void 0}}function at(e){let t={role:e.role,content:e.content};return e.route&&(t.route=e.route),e.routeMeta&&(t.route_meta=e.routeMeta),e.threadEventType&&(t.thread_event_type=e.threadEventType),e.reasoningContent&&(t.reasoning_content=e.reasoningContent),e.stopped&&(t.stopped=e.stopped),e.telemetry&&(t.telemetry=e.telemetry),t}function ot(e){return e?{model:String(e.model||``),target:e.node?`node:${String(e.node)}`:`controller`,resolved:String(e.node||``),reason:String(e.reason||``)}:{target:`controller`}}function st(e){return Ao(Array.isArray(e)?e:e?.events||[])}function ct(e,t=h){let n=[...Array.isArray(e)?e:e?.events||[]].reverse().find(e=>e.route||e.event_type===`routing_decision`);if(!n){M(t?`Thread ${t}`:`No thread created.`);return}M(JSON.stringify({thread_id:t,event_type:n.event_type,route:n.route,node:n.agent_node,model:n.model},null,2))}async function lt(){if(oe)return``;let e=await _o({title:null,default_model:l||null,metadata:rt()}),t=String(e.id||``);return g(t),re([]),I(`Thread ready`),M(JSON.stringify({id:t,metadata:e.metadata,default_model:e.default_model},null,2)),t}async function ut(e=h){if(!e)return;let t=await vo(e,E?`?include_internal=true`:``);re(st(t)),ct(t,e)}async function dt(e){let t=e.trim();if(oe||!t)return;let n=h||await lt();if(!n)return;let r={role:`user`,content:t,threadEventType:`user_message`},i={role:`assistant`,content:``,pending:!0,routeMeta:{target:`controller`}};re(e=>[...e,r,i]),N(``),le(t),se(!0),I(`Routing through controller...`);try{let e=await yo(n,{role:`user`,content:t,model:l||null,model_family:a||void 0,context_profile:s||void 0,target:d,metadata:rt()}),r=ot(e.route);re(t=>t.map(t=>t.pending?{...t,content:String(e.message?.content||`(empty response)`),pending:!1,routeMeta:r}:t)),await ut(n)}catch(e){let t=es(e);re(e=>e.map(e=>e.pending?{...e,role:`error`,content:t,pending:!1}:e)),L(t)}finally{se(!1),I(n?`Thread ${n.slice(0,8)}`:`Ready`)}}async function ft(e){let t=e.target.files?.[0];if(e.target.value=``,t){if(!t.type.startsWith(`image/`)){L(`Choose an image file.`);return}try{let e=await Uo(t);F({name:t.name,dataUrl:e}),L(``)}catch(e){L(e instanceof Error?e.message:`Failed to read image`)}}}function pt(e){let t=e.trim();return!P||!St||Ct?t:[{type:`text`,text:t},{type:`image_url`,image_url:{url:P.dataUrl}}]}async function mt(e,t,n,r){let i=Ge(t);if(i.error)throw Error(i.error);let a=i.payload||{};if(A){I(`Running agent tools...`);let t=await fo({...a,model:e,tool_runtime:`agent`,stream:!1},r.signal),i={role:`assistant`,content:Go(t),pending:!1};Do(t,i),Oo(i),Ue(n,i);return}let o=localStorage.getItem(wa.AUTH_TOKEN_STORAGE_KEY)||``,s=await fetch(`/lm-api/v1/chat/${encodeURIComponent(e)}/stream`,{method:`POST`,headers:{"Content-Type":`application/json`,Accept:`text/event-stream`,...o?{"X-UI-Session":o}:{}},body:JSON.stringify(a),signal:r.signal});if(!s.ok){if(s.status!==404)throw Error(`${s.status} ${s.statusText}: ${await s.text()}`);I(`Streaming unavailable; using standard response...`);let t=await uo(e,a),r={role:`assistant`,content:Go(t),pending:!1};Do(t,r),Oo(r),Ue(n,r);return}let c=s.headers.get(`X-Llama-Manager-Route`);if(c&&Ue(n,{route:c}),!s.body)throw Error(`Response did not include a readable stream`);await ns(s.body.getReader(),(e,t,r)=>We(n,e,t,r)),nt(n)}async function ht(e){if(p===`thread`){await dt(e);return}let t=e.trim();if(oe||!t||!l)return;let n={role:`user`,content:t,requestContent:pt(t),imageName:St&&!Ct?P?.name:void 0},r=Ge([...ne,n]);if(r.error){L(r.error);return}L(``);let i={role:`assistant`,content:``,pending:!0,startedAtMs:performance.now()},a=[...ne,n,i],o=a.length-1;re(a),N(``),F(null),le(t),se(!0),I(A?`Running agent tools...`:`Streaming response...`);let s=new AbortController;Fe.current=s;try{await mt(l,a,o,s),Ue(o,{pending:!1})}catch(e){if(e.name===`AbortError`)Ue(o,{content:`(stopped)`,pending:!1,stopped:!0});else{let t=es(e);Ue(o,{role:`error`,content:t,pending:!1}),L(t)}}finally{Fe.current=null,se(!1),I(`Ready`)}}function gt(e){e.preventDefault(),ht(te)}function _t(e){!O||e.key!==`Enter`||e.shiftKey||(e.preventDefault(),ht(te))}function vt(){Fe.current?.abort(),re(e=>e.map(e=>e.pending?{...e,content:e.content||`(stopped)`,pending:!1,stopped:!0}:e)),se(!1),I(`Ready`)}function yt(){oe||(re([]),N(``),F(null),le(``),localStorage.setItem(wa.ACTIVE_CHAT_SESSION_STORAGE_KEY,localStorage.getItem(wa.ACTIVE_CHAT_SESSION_STORAGE_KEY)||``))}let bt=t.filter(e=>W(e)&&Vo(e)),xt=bt.length===0,St=Ho(bt.find(e=>W(e)===l)),Ct=p===`thread`,wt=St&&!Ct,Tt=!!(!xt&&l&&te.trim()&&!oe),Et=!!(!xt&&te.trim()&&!oe),Dt=r.families.filter(e=>e.family&&e.profiles.length),Ot=Dt.find(e=>e.family===a),kt=[`auto`,`local`,d,...bt.map(zo)].filter((e,t,n)=>e&&n.indexOf(e)===t);return(0,R.jsxs)(`div`,{className:`chat-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:Ct?`Thread mode`:`Direct mode`}),(0,R.jsx)(`h2`,{children:`Chat`})]}),(0,R.jsx)(z,{type:`button`,onClick:Ie,children:`Refresh Models`})]}),(0,R.jsx)(pe,{message:ae}),(0,R.jsxs)(`div`,{className:`chat-layout`,children:[(0,R.jsxs)(`div`,{className:`chat-main-column`,children:[(0,R.jsx)(V,{title:`Sessions`,eyebrow:`Save and resume`,className:`chat-sessions-panel`,children:(0,R.jsxs)(`div`,{className:`chat-session-panel chat-session-panel-top`,children:[(0,R.jsx)(B,{label:`Session name`,children:(0,R.jsx)(`input`,{value:Ne,onChange:e=>Pe(e.target.value),placeholder:`Session name`})}),(0,R.jsx)(B,{label:`Saved sessions`,children:(0,R.jsxs)(`select`,{value:je,onChange:e=>Me(e.target.value),children:[(0,R.jsx)(`option`,{value:``,children:`Select a session`}),ke.map(e=>(0,R.jsx)(`option`,{value:e.id,children:Zo(e)},e.id))]})}),(0,R.jsxs)(`div`,{className:`modal-actions`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>void Xe(),children:`Refresh Sessions`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void Qe(),disabled:!je.trim(),children:`Load Session`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void $e(!1),disabled:!ne.length,children:`Save Session`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void $e(!0),disabled:!ne.length,children:`Save As New`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void et(),disabled:!je.trim(),children:`Delete Session`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void tt(),children:`Resume Recent`})]})]})}),(0,R.jsxs)(V,{title:`Transcript`,eyebrow:`Streaming response`,className:`chat-workbench-panel`,children:[(0,R.jsx)(`div`,{className:`chat-transcript`,"aria-live":`polite`,children:ne.length?ne.map((e,t)=>(0,R.jsxs)(`article`,{className:`chat-bubble chat-bubble-${e.role}`,children:[(0,R.jsx)(`span`,{className:`chat-role`,children:e.role}),Wo(e).length?(0,R.jsx)(`div`,{className:`chat-chips`,children:Wo(e).map(e=>(0,R.jsx)(`span`,{className:`chat-chip`,children:e},e))}):null,e.reasoningContent?(0,R.jsxs)(`details`,{className:`chat-reasoning`,open:e.pending?!0:void 0,children:[(0,R.jsx)(`summary`,{children:e.pending?`Reasoning (streaming...)`:`Reasoning`}),(0,R.jsx)(`pre`,{children:e.reasoningContent})]}):null,(0,R.jsx)(`p`,{children:e.content||(e.pending?`...`:`(empty response)`)}),e.imageName?(0,R.jsxs)(`small`,{children:[`image: `,e.imageName]}):null,e.route?(0,R.jsxs)(`small`,{children:[`resolved: `,e.route]}):null,e.routeMeta?.resolved?(0,R.jsxs)(`small`,{children:[`resolved: `,e.routeMeta.resolved]}):null,e.routeMeta?.reason?(0,R.jsxs)(`small`,{children:[`reason: `,e.routeMeta.reason]}):null,e.stopped?(0,R.jsx)(`small`,{children:`stopped`}):null]},`${e.role}-${t}`)):(0,R.jsx)(de,{message:`Start a running model, choose it here, and send a test prompt.`})}),(0,R.jsxs)(`form`,{className:`chat-composer`,onSubmit:gt,children:[(0,R.jsx)(B,{label:`Prompt`,children:(0,R.jsx)(`textarea`,{value:te,onChange:e=>N(e.target.value),onKeyDown:_t,rows:4,disabled:xt})}),wt?(0,R.jsxs)(`div`,{className:`chat-image-upload`,children:[(0,R.jsx)(B,{label:`Image`,children:(0,R.jsx)(`input`,{type:`file`,accept:`image/*`,onChange:ft,disabled:oe})}),P?(0,R.jsxs)(`div`,{className:`chat-image-preview`,children:[(0,R.jsx)(`img`,{src:P.dataUrl,alt:``}),(0,R.jsx)(`span`,{children:P.name}),(0,R.jsx)(z,{type:`button`,onClick:()=>F(null),disabled:oe,children:`Remove`})]}):null]}):null,(0,R.jsxs)(`div`,{className:`modal-actions`,children:[(0,R.jsxs)(`label`,{className:`checkbox-label`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:O,onChange:e=>k(e.target.checked)}),`Enter to send`]}),(0,R.jsx)(z,{type:`submit`,disabled:Ct?!Et:!Tt,children:`Send`}),(0,R.jsx)(z,{type:`button`,onClick:vt,disabled:!oe,children:`Stop`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void ht(ce),disabled:oe||!ce,children:`Regenerate`}),(0,R.jsx)(z,{type:`button`,onClick:yt,disabled:oe,children:`Clear`})]})]})]})]}),(0,R.jsxs)(V,{title:`Controls`,eyebrow:`Route and defaults`,className:`side-panel${xt?` chat-controls-unavailable`:``}`,children:[xt?(0,R.jsx)(`p`,{className:`chat-controls-warning`,role:`status`,children:`Load a model before using chat controls.`}):null,(0,R.jsxs)(`fieldset`,{className:`stacked-controls chat-controls-fieldset`,disabled:xt,"aria-disabled":xt,children:[(0,R.jsx)(B,{label:`Model`,children:(0,R.jsx)(`select`,{value:l,onChange:e=>{let t=bt.find(t=>W(t)===e.target.value);Re(e.target.value),t&&zo(t)&&f(zo(t))},children:bt.length?bt.map(e=>(0,R.jsx)(`option`,{value:W(e),children:Bo(e)},`${W(e)}-${zo(e)||`local`}`)):(0,R.jsx)(`option`,{value:``,children:`No loaded models`})})}),Dt.length?(0,R.jsxs)(R.Fragment,{children:[(0,R.jsx)(B,{label:`Model Family`,children:(0,R.jsx)(`select`,{value:a,onChange:e=>{let t=e.target.value;o(t),c(Jo(r,t))},children:Dt.map(e=>(0,R.jsx)(`option`,{value:e.family,children:e.family},e.family))})}),(0,R.jsx)(B,{label:`Context Profile`,children:(0,R.jsx)(`select`,{value:s,onChange:e=>c(e.target.value),children:(Ot?.profiles||[]).map(e=>(0,R.jsx)(`option`,{value:e.profile,children:e.label||e.profile},e.profile))})})]}):null,(0,R.jsx)(B,{label:`Target`,children:(0,R.jsx)(`select`,{value:d,onChange:e=>f(e.target.value),children:kt.map(e=>(0,R.jsx)(`option`,{value:e,children:e===`auto`?`Auto`:e===`local`?`Local`:e},e))})}),(0,R.jsx)(B,{label:`Chat Mode`,children:(0,R.jsxs)(`select`,{value:p,onChange:e=>m(e.target.value),children:[(0,R.jsx)(`option`,{value:`direct`,children:`Direct`}),(0,R.jsx)(`option`,{value:`thread`,children:`Thread`})]})}),Ct?null:(0,R.jsxs)(`label`,{className:`checkbox-label`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:A,onChange:e=>ee(e.target.checked)}),`Agent tools`]}),(0,R.jsx)(B,{label:`Preset`,children:(0,R.jsxs)(`select`,{value:ue,onChange:e=>He(e.target.value),children:[(0,R.jsx)(`option`,{value:`balanced`,children:`Balanced`}),(0,R.jsx)(`option`,{value:`precise`,children:`Precise`}),(0,R.jsx)(`option`,{value:`creative`,children:`Creative`})]})}),(0,R.jsx)(B,{label:`Temperature`,children:(0,R.jsx)(`input`,{type:`number`,step:`0.05`,value:me.temperature,onChange:e=>he(t=>({...t,temperature:Number(e.target.value||0)}))})}),(0,R.jsx)(B,{label:`Max tokens`,children:(0,R.jsx)(`input`,{type:`number`,value:me.max_tokens,onChange:e=>he(t=>({...t,max_tokens:Number(e.target.value||0)}))})}),(0,R.jsx)(B,{label:`Top P`,children:(0,R.jsx)(`input`,{type:`number`,step:`0.05`,value:me.top_p,onChange:e=>he(t=>({...t,top_p:Number(e.target.value||0)}))})}),(0,R.jsx)(z,{type:`button`,onClick:Ve,children:`Advanced`}),ge?(0,R.jsxs)(`div`,{className:`advanced-chat-panel`,children:[(0,R.jsx)(B,{label:`Top K`,children:(0,R.jsx)(`input`,{type:`number`,value:U.top_k,onChange:e=>ze(`top_k`,Number(e.target.value||0))})}),(0,R.jsx)(B,{label:`Min P`,children:(0,R.jsx)(`input`,{type:`number`,step:`0.01`,value:U.min_p,onChange:e=>ze(`min_p`,Number(e.target.value||0))})}),(0,R.jsx)(B,{label:`Repeat penalty`,children:(0,R.jsx)(`input`,{type:`number`,step:`0.01`,value:U.repeat_penalty,onChange:e=>ze(`repeat_penalty`,Number(e.target.value||0))})}),(0,R.jsx)(B,{label:`Seed`,children:(0,R.jsx)(`input`,{type:`number`,value:U.seed,onChange:e=>ze(`seed`,Number(e.target.value||0))})}),(0,R.jsx)(B,{label:`Stop tokens`,children:(0,R.jsx)(`input`,{value:U.stop,onChange:e=>ze(`stop`,e.target.value),placeholder:`</s>, User:`})}),(0,R.jsxs)(`label`,{className:`checkbox-label`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:U.reasoning,onChange:e=>ze(`reasoning`,e.target.checked)}),`Reasoning`]}),(0,R.jsxs)(`label`,{className:`checkbox-label`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:U.cache_prompt,onChange:e=>ze(`cache_prompt`,e.target.checked)}),`Cache prompt`]}),(0,R.jsx)(B,{label:`KV slot`,children:(0,R.jsx)(`input`,{type:`number`,value:U.slot_id,onChange:e=>ze(`slot_id`,e.target.value),placeholder:`auto`})}),(0,R.jsx)(B,{label:`Structured mode`,children:(0,R.jsxs)(`select`,{value:U.structuredMode,onChange:e=>ze(`structuredMode`,e.target.value),children:[(0,R.jsx)(`option`,{value:`none`,children:`None`}),(0,R.jsx)(`option`,{value:`json_schema`,children:`JSON Schema`}),(0,R.jsx)(`option`,{value:`grammar`,children:`Grammar`})]})}),(0,R.jsx)(B,{label:`JSON schema`,children:(0,R.jsx)(`textarea`,{value:U.jsonSchemaText,disabled:U.structuredMode!==`json_schema`,onChange:e=>ze(`jsonSchemaText`,e.target.value),rows:4})}),(0,R.jsx)(B,{label:`Grammar`,children:(0,R.jsx)(`textarea`,{value:U.grammarText,disabled:U.structuredMode!==`grammar`,onChange:e=>ze(`grammarText`,e.target.value),rows:4})}),(0,R.jsxs)(`div`,{className:`modal-actions`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>void Be(),children:`Refresh Capabilities`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void Ke(),disabled:!ye,children:`Copy Capabilities JSON`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void qe(),children:`Inspect prompt/template`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void Je(),children:`Refresh KV slots`})]}),(0,R.jsxs)(`div`,{className:`modal-actions`,children:[(0,R.jsx)(B,{label:`KV slot action id`,children:(0,R.jsx)(`input`,{type:`number`,value:De,onChange:e=>Oe(e.target.value),placeholder:`slot id`})}),(0,R.jsx)(z,{type:`button`,onClick:()=>void Ye(),disabled:!De.trim(),children:`Clear slot`})]}),(0,R.jsxs)(`p`,{className:`muted`,children:[`Structured output: `,U.structuredMode===`none`?`disabled`:U.structuredMode]}),(0,R.jsx)(`pre`,{className:`detail-json compact-json`,children:xe}),(0,R.jsx)(`pre`,{className:`detail-json compact-json`,children:Ce}),(0,R.jsx)(`pre`,{className:`detail-json compact-json`,children:Te})]}):null,(0,R.jsx)(H,{tone:oe?`warning`:`success`,children:ie}),Ct?(0,R.jsxs)(`div`,{className:`thread-controls`,children:[(0,R.jsx)(B,{label:`Thread ID`,children:(0,R.jsx)(`input`,{value:h,onChange:e=>g(e.target.value),placeholder:`thread id`})}),(0,R.jsx)(B,{label:`Thread App`,children:(0,R.jsx)(`input`,{value:_,onChange:e=>y(e.target.value)})}),(0,R.jsx)(B,{label:`Thread Purpose`,children:(0,R.jsx)(`input`,{value:b,onChange:e=>x(e.target.value)})}),(0,R.jsx)(B,{label:`Thread Priority`,children:(0,R.jsxs)(`select`,{value:S,onChange:e=>C(e.target.value),children:[(0,R.jsx)(`option`,{value:`low`,children:`Low`}),(0,R.jsx)(`option`,{value:`medium`,children:`Medium`}),(0,R.jsx)(`option`,{value:`high`,children:`High`})]})}),(0,R.jsx)(B,{label:`Thread Request Type`,children:(0,R.jsxs)(`select`,{value:w,onChange:e=>T(e.target.value),children:[(0,R.jsx)(`option`,{value:`general`,children:`General`}),(0,R.jsx)(`option`,{value:`coding`,children:`Coding`}),(0,R.jsx)(`option`,{value:`analysis`,children:`Analysis`})]})}),(0,R.jsxs)(`label`,{className:`checkbox-label`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:E,onChange:e=>D(e.target.checked)}),`Include internal events`]}),(0,R.jsxs)(`div`,{className:`modal-actions`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>void lt(),disabled:oe,children:`New Thread`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void ut(),disabled:oe||!h,children:`Refresh Thread`})]}),(0,R.jsx)(`pre`,{className:`detail-json`,children:j})]}):null]})]})]})]})}var os=[`mode`,`controller-identity`,`controller-first-node`,`controller-memory`,`admin-bootstrap`,`config-commands`,`verification`],ss=[`mode`,`agent-connection`,`agent-runtime-paths`,`agent-first-model`,`agent-worker`,`admin-bootstrap`,`config-commands`,`verification`],cs=[`mode`,`agent-runtime-paths`,`agent-first-model`,`admin-bootstrap`,`config-commands`,`verification`];function ls(e){return e===`controller`?os:e===`agent`?ss:cs}var us={mode:`Mode`,"controller-identity":`Controller Identity`,"controller-first-node":`First Agent Node`,"controller-memory":`Memory`,"agent-connection":`Controller Connection`,"agent-runtime-paths":`Runtime Paths`,"agent-first-model":`First Model`,"agent-worker":`Job Worker`,"admin-bootstrap":`Admin Key`,"config-commands":`Config & Commands`,verification:`Verify`},ds=new Set([`controller-first-node`,`controller-memory`,`agent-worker`]),fs=new Set([`general`,`coding`,`research`,`vision`,`summarization`]);function ps(e){return e.filter(e=>fs.has(e))}function ms(){return{log_dir:`./logs`,controller_registration_key:``,node_heartbeat_timeout_seconds:`90`,controller_instance_id:``}}function hs(){return{enabled:!1,node_name:``,agent_url:``,agent_api_key:``,default_model:``}}function gs(){return{enabled:!1,path:`./logs/agent_memory`,embedding_model_path:`./models/embedding/all-MiniLM-L6-v2`,auto_inject:!0,top_k:`3`}}function _s(){return{controller_url:``,node_name:``,agent_url:``,agent_api_key:``,controller_registration_key_outbound:``}}function vs(e=`macos`){return e===`linux`?{os:`linux`,llama_server_bin:`/home/user/Apps/llama.cpp/build/bin/llama-server`,llama_cpp_dir:`/home/user/Apps/llama.cpp`,python_bin:`python3`,hf_models_dir:`/home/user/models/HFModels`,log_dir:`./logs`}:{os:`macos`,llama_server_bin:`./llama.cpp/build/bin/llama-server`,llama_cpp_dir:`./llama.cpp`,python_bin:`python3`,hf_models_dir:`./models/HFModels`,log_dir:`./logs`}}function ys(){return{model_alias:``,path:``,port:`8080`,gpu_layers:`999`,ctx:`8192`,strengths:[`general`],cost_tier:`low`}}function bs(){return{enabled:!1,max_jobs:`1`,labels:[]}}function xs(e){return{mode:e,controllerIdentity:ms(),controllerFirstNode:hs(),controllerMemory:gs(),agentConnection:_s(),agentRuntimePaths:vs(),agentFirstModel:ys(),agentWorker:bs()}}function Ss(e){let t=e.mode===`controller`?`controller`:e.controller_url?`agent`:`standalone`,n=(e.nodes??[])[0];return{mode:t,controllerIdentity:{log_dir:e.log_dir||`./logs`,controller_registration_key:e.controller_registration_key,node_heartbeat_timeout_seconds:String(e.node_heartbeat_timeout_seconds),controller_instance_id:e.controller_instance_id},controllerFirstNode:n?{enabled:!0,node_name:n.name,agent_url:n.url,agent_api_key:n.api_key,default_model:n.default_model}:hs(),controllerMemory:{enabled:e.memory?.enabled??!1,path:e.memory?.path||`./logs/agent_memory`,embedding_model_path:e.memory?.embedding_model_path||`./models/embedding/all-MiniLM-L6-v2`,auto_inject:e.memory?.auto_inject??!0,top_k:String(e.memory?.top_k??3)},agentConnection:{controller_url:e.controller_url,node_name:e.node_name,agent_url:e.agent_url,agent_api_key:e.agent_api_key,controller_registration_key_outbound:e.controller_registration_key_outbound},agentRuntimePaths:{os:`macos`,llama_server_bin:e.llama_server_bin,llama_cpp_dir:e.llama_cpp_dir,python_bin:e.python_bin,hf_models_dir:e.hf_models_dir,log_dir:e.log_dir},agentFirstModel:e.first_model?{model_alias:e.first_model.alias,path:e.first_model.path,port:String(e.first_model.port),gpu_layers:String(e.first_model.gpu_layers),ctx:String(e.first_model.ctx),strengths:ps(e.first_model.strengths),cost_tier:e.first_model.cost_tier}:ys(),agentWorker:{enabled:e.agent_worker_enabled,max_jobs:String(e.agent_worker_max_jobs??1),labels:Object.entries(e.agent_worker_labels??{}).map(([e,t])=>({key:e,value:t}))}}}function Cs(e=`controller`){let[t,n]=(0,v.useState)(()=>xs(e)),[r,i]=(0,v.useState)(`mode`),a=ls(t.mode),o=a.indexOf(r),s=(0,v.useCallback)(()=>{i(e=>{let t=a.indexOf(e);return t<a.length-1?a[t+1]:e})},[a]),c=(0,v.useCallback)(()=>{i(e=>{let t=a.indexOf(e);return t>0?a[t-1]:e})},[a]),l=(0,v.useCallback)(e=>i(e),[]),u=(0,v.useCallback)(e=>{n(t=>({...t,mode:e})),i(ls(e)[1])},[]),d=(0,v.useCallback)((e,t)=>{n(n=>({...n,[e]:{...n[e],...t}}))},[]);return{state:t,currentStep:r,steps:a,stepIndex:o,isFirst:o===0,isLast:o===a.length-1,canSkip:ds.has(r),setMode:u,setControllerIdentity:e=>d(`controllerIdentity`,e),setControllerFirstNode:e=>d(`controllerFirstNode`,e),setControllerMemory:e=>d(`controllerMemory`,e),setAgentConnection:e=>d(`agentConnection`,e),setAgentRuntimePaths:e=>d(`agentRuntimePaths`,e),setAgentFirstModel:e=>d(`agentFirstModel`,e),setAgentWorker:e=>d(`agentWorker`,e),seedFromConfig:(0,v.useCallback)(e=>n(Ss(e)),[]),goNext:s,goBack:c,goTo:l}}var ws=[{id:`controller`,title:`Controller`,badge:`Coordinates agents`,description:`This machine routes chat requests, tracks agent nodes, and hosts the web UI. It does not need llama.cpp installed locally.`,detail:`Choose this for your central hub — a Raspberry Pi, home server, or any always-on machine.`},{id:`agent`,title:`Agent`,badge:`Runs models`,description:`This machine runs llama-server processes and is managed by a controller. It reports its status and accepts jobs from the controller.`,detail:`Choose this for GPU machines, Mac Studios, or any box with local inference power.`},{id:`standalone`,title:`Standalone`,badge:`Single machine`,description:`One machine does everything — runs models locally and serves the UI. No controller or other agents needed.`,detail:`Choose this for a simple local setup where you don't need multi-node coordination.`}];function Ts({nav:e}){let{state:t,setMode:n}=e;return(0,R.jsxs)(`div`,{className:`wizard-mode-selection`,children:[(0,R.jsx)(`h3`,{children:`What is this machine?`}),(0,R.jsx)(`p`,{className:`muted wizard-mode-intro`,children:`Choose the role for this machine. Everything else in the wizard depends on this choice.`}),(0,R.jsx)(`div`,{className:`wizard-mode-cards`,children:ws.map(e=>(0,R.jsxs)(`button`,{type:`button`,className:[`wizard-mode-card`,t.mode===e.id?`selected`:``].filter(Boolean).join(` `),onClick:()=>n(e.id),children:[(0,R.jsxs)(`div`,{className:`wizard-mode-card-header`,children:[(0,R.jsx)(`span`,{className:`wizard-mode-card-title`,children:e.title}),(0,R.jsx)(`span`,{className:`wizard-mode-card-badge`,children:e.badge})]}),(0,R.jsx)(`p`,{className:`wizard-mode-card-desc`,children:e.description}),(0,R.jsx)(`p`,{className:`wizard-mode-card-detail muted`,children:e.detail})]},e.id))})]})}function Es({nav:e}){let{isAuthenticated:t,authUser:n,acceptSession:r}=U(),[i,a]=(0,v.useState)(`admin`),[o,s]=(0,v.useState)(``),[c,l]=(0,v.useState)(``),[u,d]=(0,v.useState)(!1);if(t)return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsxs)(`p`,{className:`wizard-step-desc`,children:[`Admin key already created. You are signed in as`,` `,(0,R.jsx)(`strong`,{children:n}),`.`]}),(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Continue to the next step.`})]});if(o)return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Admin key created. Copy it now — it will not be shown again.`}),(0,R.jsxs)(`div`,{className:`wizard-secret`,children:[(0,R.jsx)(`pre`,{className:`wizard-code-block`,children:o}),(0,R.jsx)(z,{variant:`ghost`,size:`sm`,onClick:()=>navigator.clipboard.writeText(o),children:`Copy key`})]}),(0,R.jsxs)(`p`,{className:`wizard-step-desc`,children:[`You are now signed in as `,(0,R.jsx)(`strong`,{children:i}),`. Continue to generate your config.`]})]});async function f(e){e.preventDefault(),l(``),d(!0);try{let e=await ce({username:i});r({token:e.token,username:e.username,role:e.role}),s(e.key)}catch(e){l(e instanceof Error?e.message:`Bootstrap failed`)}finally{d(!1)}}return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Create the first admin key for this server. You will use this key to sign in to the UI and manage the API.`}),(0,R.jsxs)(`form`,{className:`wizard-form`,onSubmit:f,children:[(0,R.jsx)(B,{label:`Admin username`,hint:`A display name for the first admin account.`,children:(0,R.jsx)(`input`,{type:`text`,value:i,onChange:e=>a(e.target.value),required:!0,minLength:1})}),c?(0,R.jsx)(`p`,{className:`wizard-validation-error`,children:c}):null,(0,R.jsx)(`div`,{children:(0,R.jsx)(z,{variant:`primary`,type:`submit`,disabled:u,children:u?`Creating…`:`Create Admin Key`})})]})]})}function Ds(e,t,n){return t?t===`***`?`# ${e}: (configured — kept from existing config.yaml)`:`${e}: ${Os(t)}  # consider: \${${n}}`:null}function Os(e){return e===``||/^(true|false|yes|no|null|~)$/i.test(e)||/^\d/.test(e)||e.startsWith(` `)||e.endsWith(` `)||/: /.test(e)||e.endsWith(`:`)||/^[{[\|>&*!,?'"@`]/.test(e)||/ #/.test(e)?`"${e.replace(/\\/g,`\\\\`).replace(/"/g,`\\"`)}"`:e}function ks(e,t){if(!e)return[];let n=[];if(n.push(`models:`),n.push(`  ${e}:`),n.push(`    path: ${Os(t.path)}`),n.push(`    port: ${t.port}`),n.push(`    gpu_layers: ${t.gpu_layers}`),n.push(`    ctx: ${t.ctx}`),t.strengths.length>0){n.push(`    strengths:`);for(let e of t.strengths)n.push(`      - ${e}`)}return n.push(`    cost_tier: ${t.cost_tier}`),n}function As(e){let t=e.controllerIdentity,n=e.controllerFirstNode,r=e.controllerMemory,i=[];i.push(`mode: controller`),i.push(`log_dir: ${Os(t.log_dir)}`);let a=Ds(`controller_registration_key`,t.controller_registration_key,`CONTROLLER_REGISTRATION_KEY`);if(a&&i.push(a),i.push(`node_heartbeat_timeout_seconds: ${t.node_heartbeat_timeout_seconds}`),t.controller_instance_id&&i.push(`controller_instance_id: ${Os(t.controller_instance_id)}`),r.enabled&&(i.push(``),i.push(`memory:`),i.push(`  path: ${Os(r.path)}`),i.push(`  embedding_model_path: ${Os(r.embedding_model_path)}`),i.push(`  auto_inject: ${r.auto_inject}`),i.push(`  top_k: ${r.top_k}`)),n.enabled&&n.node_name){i.push(``),i.push(`nodes:`),i.push(`  ${n.node_name}:`),i.push(`    url: ${Os(n.agent_url)}`);let e=Ds(`    api_key`,n.agent_api_key,`AGENT_API_KEY`);e&&i.push(e),n.default_model&&i.push(`    default_model: ${Os(n.default_model)}`)}return i.join(`
`)}function js(e){let t=e.agentConnection,n=e.agentRuntimePaths,r=e.agentFirstModel,i=e.agentWorker,a=[];a.push(`mode: agent`),t.controller_url&&a.push(`controller_url: ${Os(t.controller_url)}`),t.node_name&&a.push(`node_name: ${Os(t.node_name)}`),t.agent_url&&a.push(`agent_url: ${Os(t.agent_url)}`);let o=Ds(`agent_api_key`,t.agent_api_key,`AGENT_API_KEY`);o&&a.push(o);let s=Ds(`controller_registration_key_outbound`,t.controller_registration_key_outbound,`CONTROLLER_REGISTRATION_KEY`);if(s&&a.push(s),a.push(`llama_server_bin: ${Os(n.llama_server_bin)}`),a.push(`llama_cpp_dir: ${Os(n.llama_cpp_dir)}`),a.push(`python_bin: ${Os(n.python_bin)}`),a.push(`hf_models_dirs:`),a.push(`  - ${Os(n.hf_models_dir)}`),a.push(`log_dir: ${Os(n.log_dir)}`),i.enabled){a.push(`agent_worker_enabled: true`),a.push(`agent_worker_max_jobs: ${i.max_jobs}`);let e=i.labels.filter(e=>e.key);if(e.length>0){a.push(`agent_worker_labels:`);for(let t of e)a.push(`  ${t.key}: ${Os(t.value)}`)}}let c=ks(r.model_alias,r);return c.length>0&&(a.push(``),a.push(...c)),a.join(`
`)}function Ms(e){let t=e.agentRuntimePaths,n=e.agentFirstModel,r=e.agentWorker,i=[];if(i.push(`mode: agent`),i.push(`llama_server_bin: ${Os(t.llama_server_bin)}`),i.push(`llama_cpp_dir: ${Os(t.llama_cpp_dir)}`),i.push(`python_bin: ${Os(t.python_bin)}`),i.push(`hf_models_dirs:`),i.push(`  - ${Os(t.hf_models_dir)}`),i.push(`log_dir: ${Os(t.log_dir)}`),r.enabled){i.push(`agent_worker_enabled: true`),i.push(`agent_worker_max_jobs: ${r.max_jobs}`);let e=r.labels.filter(e=>e.key);if(e.length>0){i.push(`agent_worker_labels:`);for(let t of e)i.push(`  ${t.key}: ${Os(t.value)}`)}}let a=ks(n.model_alias,n);return a.length>0&&(i.push(``),i.push(...a)),i.join(`
`)}function Ns(e){return e.mode===`controller`?As(e):e.mode===`agent`?js(e):Ms(e)}function Ps(e){let{mode:t}=e,n=e.agentConnection;if(t===`controller`)return[`# 1. Run migrations and create the first admin key`,`bash scripts/onboard_controller.sh${e.controllerMemory.enabled?` --enable-memory --memory-model-path ${e.controllerMemory.embedding_model_path}`:``}`,``,`# 2. Start the controller`,`bash scripts/start_controller.sh`].join(`
`);if(t===`agent`){let e=[];return n.node_name&&e.push(`NODE_NAME="${n.node_name}"`),n.controller_url&&e.push(`CONTROLLER_URL="${n.controller_url}"`),n.agent_url&&e.push(`AGENT_URL="${n.agent_url}"`),[`# 1. Register this agent with the controller`,`${e.length>0?e.map((e,t)=>t===0?e:`  ${e}`).join(` \\
`)+` \\
  `:``}bash scripts/onboard_agent.sh`,``,`# 2. Start the agent`,`bash scripts/start_agent.sh`].join(`
`)}return[`# 1. Initialize databases and create the first admin key`,`bash scripts/onboard_controller.sh`,``,`# 2. Start the server`,`bash scripts/start_agent.sh`].join(`
`)}function Fs(e){let t=new Blob([e],{type:`text/yaml`}),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`config.yaml`,r.click(),URL.revokeObjectURL(n)}function Is({nav:e}){let{state:t}=e,n=t.mode===`controller`,[r,i]=(0,v.useState)(`config`),[a,o]=(0,v.useState)(!1),s=Ns(t),c=Ps(t),l=t.controllerIdentity.controller_registration_key;async function u(e){await navigator.clipboard.writeText(e),o(!0),setTimeout(()=>o(!1),2e3)}return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsxs)(`p`,{className:`wizard-step-desc`,children:[`Your configuration is ready. Copy or download`,` `,(0,R.jsx)(`code`,{children:`config.yaml`}),` and place it in the project root, then run the setup commands.`]}),(0,R.jsxs)(`div`,{className:`wizard-tabs`,role:`tablist`,children:[(0,R.jsx)(`button`,{role:`tab`,"aria-selected":r===`config`,className:`wizard-tab-btn${r===`config`?` active`:``}`,onClick:()=>i(`config`),children:`Config`}),(0,R.jsx)(`button`,{role:`tab`,"aria-selected":r===`commands`,className:`wizard-tab-btn${r===`commands`?` active`:``}`,onClick:()=>i(`commands`),children:`Commands`}),n?(0,R.jsx)(`button`,{role:`tab`,"aria-selected":r===`reg-key`,className:`wizard-tab-btn${r===`reg-key`?` active`:``}`,onClick:()=>i(`reg-key`),children:`Registration Key`}):null]}),r===`config`?(0,R.jsxs)(`div`,{className:`wizard-tab-content`,children:[(0,R.jsx)(`pre`,{className:`wizard-code-block`,children:s}),(0,R.jsxs)(`div`,{className:`wizard-config-actions`,children:[(0,R.jsx)(z,{variant:`primary`,onClick:()=>Fs(s),children:`Download config.yaml`}),(0,R.jsx)(z,{variant:`ghost`,onClick:()=>u(s),children:a?`Copied!`:`Copy to clipboard`})]})]}):null,r===`commands`?(0,R.jsxs)(`div`,{className:`wizard-tab-content`,children:[(0,R.jsx)(`pre`,{className:`wizard-code-block`,children:c}),(0,R.jsx)(`div`,{className:`wizard-config-actions`,children:(0,R.jsx)(z,{variant:`ghost`,onClick:()=>u(c),children:a?`Copied!`:`Copy to clipboard`})})]}):null,r===`reg-key`&&n?(0,R.jsxs)(`div`,{className:`wizard-tab-content`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Share this key with every agent that needs to register with this controller. Store it securely — treat it like a password.`}),l?(0,R.jsxs)(R.Fragment,{children:[(0,R.jsx)(`pre`,{className:`wizard-code-block wizard-secret`,children:l}),(0,R.jsx)(`div`,{className:`wizard-config-actions`,children:(0,R.jsx)(z,{variant:`ghost`,onClick:()=>u(l),children:a?`Copied!`:`Copy key`})})]}):(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`No registration key was set. Go back to Controller Identity to generate one.`})]}):null]})}function Ls({state:e}){return e===`pass`?(0,R.jsx)(`span`,{className:`wizard-check-icon pass`,children:`✓`}):e===`fail`?(0,R.jsx)(`span`,{className:`wizard-check-icon fail`,children:`✗`}):(0,R.jsx)(`span`,{className:`wizard-check-icon unknown`,children:`○`})}function Rs({nav:e}){let t=e.state.mode,[n,r]=(0,v.useState)([]),[i,a]=(0,v.useState)(!1),o=(0,v.useCallback)(async()=>{a(!0);let n=[],i;try{i=(await S()).mode,n.push({label:`Backend online`,state:`pass`})}catch{n.push({label:`Backend online`,state:`fail`,reason:`Could not reach server`})}let o=t===`controller`?`controller`:`agent`;i===void 0?n.push({label:`Correct mode (${o})`,state:`unknown`}):n.push({label:`Correct mode (${o})`,state:i===o?`pass`:`fail`,reason:i===o?void 0:`Server reports mode: ${i}`});try{let e=await se();n.push({label:`Auth configured`,state:e.auth_enabled?`pass`:`fail`,reason:e.auth_enabled?void 0:`Auth not yet bootstrapped`})}catch{n.push({label:`Auth configured`,state:`unknown`})}if(t===`controller`)try{let e=((await pi()).nodes??[]).filter(e=>e.heartbeat_fresh);n.push({label:`At least one node online`,state:e.length>0?`pass`:`fail`,reason:e.length===0?`No nodes with a fresh heartbeat`:void 0})}catch{n.push({label:`At least one node online`,state:`unknown`})}if(t===`agent`)if(e.state.agentConnection.controller_url)try{let e=await C();n.push({label:`Controller reachable`,state:e.reachable?`pass`:`fail`,reason:e.reachable?void 0:e.error||`Could not connect`})}catch{n.push({label:`Controller reachable`,state:`fail`,reason:`Could not connect`})}else n.push({label:`Controller reachable`,state:`unknown`,reason:`No controller URL set`});r(n),a(!1)},[t,e.state.agentConnection.controller_url]);(0,v.useEffect)(()=>{o()},[o]);let s=n.length>0&&n.every(e=>e.state===`pass`);return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Verifying that everything is running correctly.`}),(0,R.jsxs)(`div`,{className:`wizard-checks`,children:[n.length===0&&i?(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Checking…`}):null,n.map(e=>(0,R.jsxs)(`div`,{className:`wizard-check-row`,children:[(0,R.jsx)(Ls,{state:e.state}),(0,R.jsx)(`span`,{children:e.label}),e.reason?(0,R.jsx)(`span`,{className:`wizard-check-reason`,children:e.reason}):null]},e.label))]}),s?(0,R.jsx)(`p`,{className:`wizard-step-desc`,style:{color:`var(--success)`},children:`All checks passed — setup is complete!`}):null,(0,R.jsx)(`div`,{children:(0,R.jsx)(z,{variant:`ghost`,onClick:()=>void o(),disabled:i,children:i?`Checking…`:`Refresh`})})]})}function zs(){let e=new Uint8Array(24);return crypto.getRandomValues(e),Array.from(e).map(e=>e.toString(16).padStart(2,`0`)).join(``)}function Bs({nav:e}){let{state:t,setControllerIdentity:n}=e,r=t.controllerIdentity;return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Configure how this controller identifies itself and how agents register with it.`}),(0,R.jsxs)(`div`,{className:`wizard-form`,children:[(0,R.jsx)(B,{label:`Log directory`,hint:`Directory for runtime logs and state files.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.log_dir,onChange:e=>n({log_dir:e.target.value}),placeholder:`./logs`})}),(0,R.jsx)(B,{label:`Controller registration key`,hint:r.controller_registration_key===`***`?`Key is already configured — clear to replace.`:`Agents use this key when registering with the controller. Store it securely.`,children:(0,R.jsxs)(`div`,{className:`wizard-key-row`,children:[(0,R.jsx)(`input`,{type:`text`,value:r.controller_registration_key,onChange:e=>n({controller_registration_key:e.target.value}),placeholder:`Paste or auto-generate`}),(0,R.jsx)(z,{variant:`ghost`,size:`sm`,onClick:()=>n({controller_registration_key:zs()}),children:`Auto-generate`})]})}),(0,R.jsx)(B,{label:`Node heartbeat timeout (seconds)`,hint:`How long before an unresponsive agent is marked offline.`,children:(0,R.jsx)(`input`,{type:`number`,min:10,value:r.node_heartbeat_timeout_seconds,onChange:e=>n({node_heartbeat_timeout_seconds:e.target.value})})}),(0,R.jsx)(B,{label:`Controller instance ID (optional)`,hint:`A unique name for this controller — useful when running multiple controllers.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.controller_instance_id,onChange:e=>n({controller_instance_id:e.target.value}),placeholder:`e.g. pi-controller-home`})})]})]})}function Vs({nav:e}){let{state:t,setControllerFirstNode:n}=e,r=t.controllerFirstNode;return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Optionally register your first agent node now. You can add more nodes directly in the config file later.`}),(0,R.jsxs)(`label`,{className:`wizard-toggle`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:r.enabled,onChange:e=>n({enabled:e.target.checked})}),(0,R.jsx)(`span`,{className:`wizard-toggle-label`,children:`Add a node now`})]}),r.enabled?(0,R.jsxs)(`div`,{className:`wizard-subsection wizard-form`,children:[(0,R.jsx)(B,{label:`Node name`,hint:`A unique identifier for this agent (used as the config key).`,children:(0,R.jsx)(`input`,{type:`text`,value:r.node_name,onChange:e=>n({node_name:e.target.value}),placeholder:`e.g. mac-studio`})}),(0,R.jsx)(B,{label:`Agent URL`,hint:`The URL the controller uses to reach this agent.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.agent_url,onChange:e=>n({agent_url:e.target.value}),placeholder:`http://192.168.1.20:9137`})}),(0,R.jsx)(B,{label:`Agent API key`,hint:r.agent_api_key===`***`?`Key is already configured — clear to replace.`:`The API key this agent accepts on inbound requests.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.agent_api_key,onChange:e=>n({agent_api_key:e.target.value}),placeholder:`lm_agent_...`})}),(0,R.jsx)(B,{label:`Default model`,hint:`Model alias to use when no specific model is requested.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.default_model,onChange:e=>n({default_model:e.target.value}),placeholder:`e.g. qwen2.5-7b`})})]}):null]})}function Hs({nav:e}){let{state:t,setControllerMemory:n}=e,r=t.controllerMemory;return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Semantic memory lets the controller inject relevant conversation history and documents into chat context automatically.`}),(0,R.jsxs)(`label`,{className:`wizard-toggle`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:r.enabled,onChange:e=>n({enabled:e.target.checked})}),(0,R.jsx)(`span`,{className:`wizard-toggle-label`,children:`Enable semantic memory (ChromaDB + local embedding model)`})]}),r.enabled?(0,R.jsxs)(R.Fragment,{children:[(0,R.jsxs)(`div`,{className:`wizard-subsection wizard-form`,children:[(0,R.jsx)(B,{label:`Memory store path`,hint:`Where ChromaDB persists its vector data.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.path,onChange:e=>n({path:e.target.value}),placeholder:`./logs/agent_memory`})}),(0,R.jsx)(B,{label:`Embedding model path`,hint:`Path to the local sentence-transformers model directory.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.embedding_model_path,onChange:e=>n({embedding_model_path:e.target.value}),placeholder:`./models/embedding/all-MiniLM-L6-v2`})}),(0,R.jsx)(B,{label:`Top-K results`,hint:`Number of memory chunks to inject per request.`,children:(0,R.jsx)(`input`,{type:`number`,min:1,max:20,value:r.top_k,onChange:e=>n({top_k:e.target.value})})}),(0,R.jsxs)(`label`,{className:`wizard-toggle`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:r.auto_inject,onChange:e=>n({auto_inject:e.target.checked})}),(0,R.jsx)(`span`,{className:`wizard-toggle-label`,children:`Auto-inject into chat`})]})]}),(0,R.jsxs)(`div`,{className:`wizard-callout`,children:[(0,R.jsx)(`strong`,{children:`Use controller onboarding to install and configure memory:`}),(0,R.jsx)(`pre`,{className:`wizard-code-block`,children:`bash scripts/onboard_controller.sh --enable-memory --memory-model-path ${r.embedding_model_path}`})]})]}):null]})}function Us({nav:e}){let{state:t,setAgentConnection:n}=e,r=t.agentConnection;return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Configure how this agent connects to and registers with its controller.`}),(0,R.jsxs)(`div`,{className:`wizard-form`,children:[(0,R.jsx)(B,{label:`Controller URL`,hint:`The base URL of the controller this agent reports to.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.controller_url,onChange:e=>n({controller_url:e.target.value}),placeholder:`http://192.168.1.10:9137`})}),(0,R.jsx)(B,{label:`Node name`,hint:`A unique identifier for this agent node on the controller.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.node_name,onChange:e=>n({node_name:e.target.value}),placeholder:`e.g. mac-studio`})}),(0,R.jsx)(B,{label:`Agent URL`,hint:`The URL the controller uses to reach this agent.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.agent_url,onChange:e=>n({agent_url:e.target.value}),placeholder:`http://192.168.1.20:9137`})}),(0,R.jsx)(B,{label:`Agent API key`,hint:r.agent_api_key===`***`?`Key is already configured — clear to replace.`:`The key this agent accepts on inbound requests from the controller.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.agent_api_key,onChange:e=>n({agent_api_key:e.target.value}),placeholder:`lm_agent_...`})}),(0,R.jsx)(B,{label:`Controller registration key`,hint:r.controller_registration_key_outbound===`***`?`Key is already configured — clear to replace.`:`The key set on the controller — this agent sends it when registering.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.controller_registration_key_outbound,onChange:e=>n({controller_registration_key_outbound:e.target.value}),placeholder:`Hex key from the controller setup`})})]})]})}var Ws={macos:{llama_server_bin:`./llama.cpp/build/bin/llama-server`,llama_cpp_dir:`./llama.cpp`,hf_models_dir:`./models/HFModels`},linux:{llama_server_bin:`/home/user/Apps/llama.cpp/build/bin/llama-server`,llama_cpp_dir:`/home/user/Apps/llama.cpp`,hf_models_dir:`/home/user/models/HFModels`}};function Gs({nav:e}){let{state:t,setAgentRuntimePaths:n}=e,r=t.agentRuntimePaths;function i(e){n({os:e,...Ws[e]})}return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Tell the agent where to find llama.cpp and your models. Choose your OS to pre-fill sensible defaults.`}),(0,R.jsxs)(`div`,{className:`wizard-form`,children:[(0,R.jsx)(B,{label:`Operating system`,children:(0,R.jsxs)(`select`,{value:r.os,onChange:e=>i(e.target.value),children:[(0,R.jsx)(`option`,{value:`macos`,children:`macOS`}),(0,R.jsx)(`option`,{value:`linux`,children:`Linux`})]})}),(0,R.jsx)(B,{label:`llama-server binary`,hint:`Full path to the llama-server executable.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.llama_server_bin,onChange:e=>n({llama_server_bin:e.target.value})})}),(0,R.jsx)(B,{label:`llama.cpp directory`,hint:`Root of your llama.cpp checkout (used for model conversion scripts).`,children:(0,R.jsx)(`input`,{type:`text`,value:r.llama_cpp_dir,onChange:e=>n({llama_cpp_dir:e.target.value})})}),(0,R.jsx)(B,{label:`Python binary`,hint:`Python used for conversion and quantization scripts.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.python_bin,onChange:e=>n({python_bin:e.target.value})})}),(0,R.jsx)(B,{label:`HuggingFace models directory`,hint:`Where downloaded HF model repos are stored.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.hf_models_dir,onChange:e=>n({hf_models_dir:e.target.value})})}),(0,R.jsx)(B,{label:`Log directory`,hint:`Directory for runtime logs and state files.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.log_dir,onChange:e=>n({log_dir:e.target.value})})})]})]})}var Ks=[{label:`Qwen 2.5 7B (fast, general)`,fields:{path:`./models/qwen2.5-7b-instruct-q4_k_m.gguf`,port:`8080`,gpu_layers:`999`,ctx:`8192`,strengths:[`general`,`coding`],cost_tier:`low`}},{label:`Llama 3.1 8B`,fields:{path:`./models/llama-3.1-8b-instruct-q4_k_m.gguf`,port:`8080`,gpu_layers:`999`,ctx:`8192`,strengths:[`general`],cost_tier:`low`}},{label:`Gemma 3 4B (vision)`,fields:{path:`./models/gemma-3-4b-it-q4_k_m.gguf`,port:`8081`,gpu_layers:`999`,ctx:`8192`,strengths:[`general`,`vision`],cost_tier:`low`}},{label:`Custom (fill in manually)`,fields:{path:``,port:`8080`,gpu_layers:`999`,ctx:`8192`,strengths:[],cost_tier:`low`}}],qs=[`general`,`coding`,`research`,`vision`,`summarization`];function Js({nav:e}){let{state:t,setAgentFirstModel:n}=e,r=t.agentFirstModel;function i(e){let t=Ks.find(t=>t.label===e);t&&n(t.fields)}function a(e){n({strengths:r.strengths.includes(e)?r.strengths.filter(t=>t!==e):[...r.strengths,e]})}return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Define one model to get started. More models can be added directly in the config file later.`}),(0,R.jsxs)(`div`,{className:`wizard-form`,children:[(0,R.jsx)(B,{label:`Preset`,hint:`Selecting a preset fills in the fields below — you can still edit them.`,children:(0,R.jsxs)(`select`,{defaultValue:``,onChange:e=>i(e.target.value),children:[(0,R.jsx)(`option`,{value:``,disabled:!0,children:`Choose a preset…`}),Ks.map(e=>(0,R.jsx)(`option`,{value:e.label,children:e.label},e.label))]})}),(0,R.jsx)(B,{label:`Model alias`,hint:`A short name used to reference this model in routing rules.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.model_alias,onChange:e=>n({model_alias:e.target.value}),placeholder:`e.g. qwen2.5-7b`})}),(0,R.jsx)(B,{label:`Path to GGUF file`,hint:`Absolute or relative path to the quantized model file.`,children:(0,R.jsx)(`input`,{type:`text`,value:r.path,onChange:e=>n({path:e.target.value}),placeholder:`./models/my-model-q4_k_m.gguf`})}),(0,R.jsxs)(`div`,{className:`wizard-form-row`,children:[(0,R.jsx)(B,{label:`Port`,children:(0,R.jsx)(`input`,{type:`number`,min:1024,max:65535,value:r.port,onChange:e=>n({port:e.target.value})})}),(0,R.jsx)(B,{label:`GPU layers`,hint:`999 = all layers on GPU.`,children:(0,R.jsx)(`input`,{type:`number`,min:0,value:r.gpu_layers,onChange:e=>n({gpu_layers:e.target.value})})}),(0,R.jsx)(B,{label:`Context size (tokens)`,children:(0,R.jsx)(`input`,{type:`number`,min:512,value:r.ctx,onChange:e=>n({ctx:e.target.value})})})]}),(0,R.jsx)(B,{label:`Strengths`,hint:`Used by the router to match requests to the right model.`,children:(0,R.jsx)(`div`,{className:`wizard-strength-checks`,children:qs.map(e=>(0,R.jsxs)(`label`,{className:`wizard-toggle`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:r.strengths.includes(e),onChange:()=>a(e)}),(0,R.jsx)(`span`,{className:`wizard-toggle-label`,children:e})]},e))})}),(0,R.jsx)(B,{label:`Cost tier`,children:(0,R.jsxs)(`select`,{value:r.cost_tier,onChange:e=>n({cost_tier:e.target.value}),children:[(0,R.jsx)(`option`,{value:`low`,children:`Low`}),(0,R.jsx)(`option`,{value:`medium`,children:`Medium`}),(0,R.jsx)(`option`,{value:`high`,children:`High`})]})})]})]})}function Ys({nav:e}){let{state:t,setAgentWorker:n}=e,r=t.agentWorker;function i(){n({labels:[...r.labels,{key:``,value:``}]})}function a(e,t,i){n({labels:r.labels.map((n,r)=>r===e?{...n,[t]:i}:n)})}function o(e){n({labels:r.labels.filter((t,n)=>n!==e)})}return(0,R.jsxs)(`div`,{className:`wizard-step`,children:[(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`The job worker lets this agent claim and process jobs queued by the controller (LLM generation, embedding, batch, model transfer).`}),(0,R.jsxs)(`label`,{className:`wizard-toggle`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:r.enabled,onChange:e=>n({enabled:e.target.checked})}),(0,R.jsx)(`span`,{className:`wizard-toggle-label`,children:`Enable job worker`})]}),r.enabled?(0,R.jsxs)(`div`,{className:`wizard-subsection wizard-form`,children:[(0,R.jsx)(B,{label:`Max concurrent jobs`,hint:`How many jobs this agent runs in parallel.`,children:(0,R.jsx)(`input`,{type:`number`,min:1,value:r.max_jobs,onChange:e=>n({max_jobs:e.target.value})})}),(0,R.jsxs)(`div`,{className:`wizard-labels-section`,children:[(0,R.jsx)(`span`,{className:`wizard-labels-heading`,children:`Labels`}),(0,R.jsx)(`p`,{className:`wizard-step-desc`,children:`Key-value labels the controller can use to route specific jobs to this worker.`}),r.labels.map((e,t)=>(0,R.jsxs)(`div`,{className:`wizard-label-row`,children:[(0,R.jsx)(`input`,{type:`text`,value:e.key,onChange:e=>a(t,`key`,e.target.value),placeholder:`key`}),(0,R.jsx)(`span`,{className:`wizard-label-sep`,children:`:`}),(0,R.jsx)(`input`,{type:`text`,value:e.value,onChange:e=>a(t,`value`,e.target.value),placeholder:`value`}),(0,R.jsx)(z,{variant:`ghost`,size:`sm`,onClick:()=>o(t),"aria-label":`Remove label`,children:`✕`})]},t)),(0,R.jsx)(z,{variant:`ghost`,size:`sm`,onClick:i,children:`+ Add label`})]})]}):null]})}function Xs(e){return e?.mode===`controller`?`controller`:`standalone`}function Zs({nav:e}){let{steps:t,stepIndex:n}=e;return(0,R.jsx)(`div`,{className:`wizard-step-indicator`,"aria-label":`Setup progress`,children:t.map((e,t)=>(0,R.jsx)(`div`,{className:[`wizard-step-pip`,t<n?`done`:``,t===n?`active`:``].filter(Boolean).join(` `),title:us[e],children:(0,R.jsx)(`span`,{className:`wizard-step-pip-label`,children:us[e]})},e))})}function Qs({nav:e}){let{isFirst:t,isLast:n,canSkip:r,goNext:i,goBack:a}=e;return(0,R.jsx)(`div`,{className:`wizard-footer`,children:(0,R.jsxs)(`div`,{className:`wizard-footer-actions`,children:[t?null:(0,R.jsx)(z,{variant:`ghost`,onClick:a,children:`Back`}),r?(0,R.jsx)(z,{variant:`link`,onClick:i,children:`Skip`}):null,n?(0,R.jsx)(z,{variant:`success`,onClick:i,children:`Done`}):(0,R.jsx)(z,{variant:`primary`,onClick:i,children:`Continue`})]})})}function $s({nav:e}){let{currentStep:t}=e;switch(t){case`mode`:return(0,R.jsx)(Ts,{nav:e});case`controller-identity`:return(0,R.jsx)(Bs,{nav:e});case`controller-first-node`:return(0,R.jsx)(Vs,{nav:e});case`controller-memory`:return(0,R.jsx)(Hs,{nav:e});case`agent-connection`:return(0,R.jsx)(Us,{nav:e});case`agent-runtime-paths`:return(0,R.jsx)(Gs,{nav:e});case`agent-first-model`:return(0,R.jsx)(Js,{nav:e});case`agent-worker`:return(0,R.jsx)(Ys,{nav:e});case`admin-bootstrap`:return(0,R.jsx)(Es,{nav:e});case`config-commands`:return(0,R.jsx)(Is,{nav:e});case`verification`:return(0,R.jsx)(Rs,{nav:e});default:return null}}function ec(){let[e,t]=(0,v.useState)(null),n=Cs(Xs(e));return(0,v.useEffect)(()=>{se().catch(()=>{}).then(e=>{e&&t(e)}),le().catch(()=>{}).then(e=>{e&&n.seedFromConfig(e)})},[]),(0,R.jsxs)(`div`,{className:`setup-page-react wizard-page`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`First Run`}),(0,R.jsx)(`h2`,{children:`Setup Wizard`})]}),(0,R.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:`1rem`},children:[n.currentStep===`mode`?null:(0,R.jsxs)(`span`,{className:`muted`,children:[n.state.mode,` mode`]}),(0,R.jsx)(`a`,{href:`/ui/docs`,className:`btn btn-ghost`,style:{fontSize:`0.8rem`},children:`Docs`})]})]}),(0,R.jsx)(Zs,{nav:n}),(0,R.jsx)(`div`,{className:`wizard-step-body`,children:(0,R.jsx)($s,{nav:n})}),n.currentStep===`mode`?null:(0,R.jsx)(Qs,{nav:n})]})}function tc(e){if(Array.isArray(e))return e;let t=e?.nodes;return Array.isArray(t)?t:[]}function nc(e,t){let n=String(t.model_path||t.path||t.filename||``).toLowerCase();return!!(e.reachable&&Oa(t)&&n.endsWith(`.gguf`))}function rc(e){if(!e)return``;let t=e.files_total,n=e.files_copied,r=e.files_skipped;return t==null&&n==null&&r==null?``:`${Number(n||0)}/${Number(t||0)} files copied, ${Number(r||0)} skipped`}function ic(){let{openLogs:e}=Ei(),{data:t,loading:n,error:r,refresh:i,setError:a}=ua(()=>Promise.all([pi(),mi()]).then(([e,t])=>Ga(tc(e),tc(t))),[]),[o,s]=(0,v.useState)(``),[c,l]=(0,v.useState)(``),[u,d]=(0,v.useState)(``),[f,p]=(0,v.useState)(null),[m,h]=(0,v.useState)(null),g=(0,v.useMemo)(()=>Ua(t,{query:o,status:c,registration:u}),[t,o,c,u]),_=Wa(t);function y(e){p(Ya(e))}async function b(){!f?.name||!f.url||(await bi(f.name,{url:f.url,api_key:f.api_key,verify_tls:f.verify_tls}),p(null),await i())}async function x(e,t,n){n===`start`&&await gi(e,t),n===`stop`&&await _i(e,t),n===`restart`&&await vi(e,t),await i()}function S(e,n){let r=String(e.name||``),i=Xa(t,r);h({sourceNode:r,modelName:W(n),sourceFileId:Oa(n),destinationNode:String(i[0]?.name||``),include:`selected_with_sidecars`,status:null,submitting:!1})}async function C(){if(!(!m?.sourceNode||!m.destinationNode||!m.sourceFileId)){a(``),h({...m,submitting:!0});try{let e=await ga(m.sourceNode,{destination_node:m.destinationNode,source_file_id:m.sourceFileId,include:m.include}),t=String(e.id||``),n=t?await yi(t):e;h(e=>e&&{...e,status:n,submitting:!1})}catch(e){a(e instanceof Error?e.message:`Failed to start transfer`),h(e=>e&&{...e,submitting:!1})}}}let w=m?Xa(t,m.sourceNode):[],T=rc(m?.status||null);return(0,R.jsxs)(`div`,{className:`nodes-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Fleet`}),(0,R.jsx)(`h2`,{children:`Nodes`})]}),(0,R.jsxs)(`span`,{className:`muted`,children:[_.reachable,`/`,_.total,` reachable nodes, `,_.models,` reported models`]})]}),(0,R.jsxs)(`div`,{className:`filter-bar nodes-filter-bar`,children:[(0,R.jsx)(B,{label:`Node or URL`,children:(0,R.jsx)(`input`,{value:o,onChange:e=>s(e.target.value),placeholder:`node or url`})}),(0,R.jsx)(B,{label:`Status`,children:(0,R.jsxs)(`select`,{value:c,onChange:e=>l(e.target.value),children:[(0,R.jsx)(`option`,{value:``,children:`all`}),(0,R.jsx)(`option`,{value:`reachable`,children:`reachable`}),(0,R.jsx)(`option`,{value:`offline`,children:`offline`})]})}),(0,R.jsx)(B,{label:`Registration`,children:(0,R.jsxs)(`select`,{value:u,onChange:e=>d(e.target.value),children:[(0,R.jsx)(`option`,{value:``,children:`all registrations`}),(0,R.jsx)(`option`,{value:`static`,children:`static`}),(0,R.jsx)(`option`,{value:`dynamic`,children:`dynamic`})]})}),(0,R.jsx)(z,{type:`button`,onClick:i,disabled:n,children:n?`Refreshing`:`Refresh Nodes`})]}),(0,R.jsxs)(V,{className:`nodes-page-panel`,children:[(0,R.jsx)(pe,{message:r}),!r&&g.length===0?(0,R.jsx)(de,{message:n?`Loading nodes...`:`No nodes match the current filters.`}):null,(0,R.jsx)(`div`,{className:`nodes-page-list`,children:g.map(t=>(0,R.jsxs)(`article`,{className:`node node-full`,children:[(0,R.jsxs)(`div`,{className:`node-header`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`strong`,{children:t.name||`unnamed node`}),(0,R.jsx)(`div`,{className:`node-url`,children:t.url||`-`})]}),(0,R.jsxs)(`div`,{className:`node-header-actions`,children:[(0,R.jsx)(H,{tone:t.reachable?`success`:`danger`,children:t.reachable?`reachable`:`offline`}),(0,R.jsx)(H,{tone:t.heartbeat_fresh?`success`:`danger`,children:t.heartbeat_fresh?`fresh`:`stale`}),(0,R.jsx)(z,{type:`button`,onClick:()=>y(t),"aria-label":`Edit ${t.name}`,children:`Edit Node`})]})]}),(0,R.jsx)(`div`,{className:`model-cards`,children:t.models?.length?Ja(t.models).map(n=>{let r=W(n);return(0,R.jsxs)(`article`,{className:`model-card ${Sa(n)?`active`:``}`.trim(),children:[(0,R.jsx)(`strong`,{children:r}),(0,R.jsx)(`span`,{children:String(n.status||`available`)}),(0,R.jsxs)(`div`,{className:`model-actions`,children:[(0,R.jsx)(`button`,{type:`button`,onClick:()=>void x(t.name||``,r,`start`),"aria-label":`Start ${r} on ${t.name}`,children:`Start`}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>void x(t.name||``,r,`stop`),"aria-label":`Stop ${r} on ${t.name}`,children:`Stop`}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>void x(t.name||``,r,`restart`),"aria-label":`Restart ${r} on ${t.name}`,children:`Restart`}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>e({source:`node-model`,identifier:r,node:t.name||``,autoLoad:!0}),"aria-label":`View logs for ${r} on ${t.name}`,children:`Logs`}),nc(t,n)?(0,R.jsx)(`button`,{type:`button`,onClick:()=>S(t,n),"aria-label":`Send ${r} from ${t.name}`,children:`Send`}):null]})]},r)}):(0,R.jsx)(de,{message:String(t.error||`No models reported.`)})})]},t.name||t.url))})]}),(0,R.jsx)(me,{title:f?`Edit ${f.name}`:`Edit Node`,open:!!f,onClose:()=>p(null),children:f?(0,R.jsxs)(`div`,{className:`node-edit-form`,children:[(0,R.jsx)(`input`,{type:`hidden`,value:f.name,readOnly:!0}),(0,R.jsx)(B,{label:`URL`,children:(0,R.jsx)(`input`,{value:f.url,onChange:e=>p({...f,url:e.target.value}),type:`url`})}),(0,R.jsx)(B,{label:`API key`,children:(0,R.jsx)(`input`,{value:f.api_key,onChange:e=>p({...f,api_key:e.target.value}),type:`password`,placeholder:`leave blank for none`})}),(0,R.jsxs)(`label`,{className:`checkbox-label`,children:[(0,R.jsx)(`input`,{checked:f.verify_tls,onChange:e=>p({...f,verify_tls:e.target.checked}),type:`checkbox`}),(0,R.jsx)(`span`,{children:`Verify TLS`})]}),(0,R.jsx)(z,{type:`button`,onClick:()=>void b(),children:`Save Node`})]}):null}),(0,R.jsx)(no,{transfer:m,destinationOptions:w,onClose:()=>h(null),onChangeDestination:e=>h(t=>t&&{...t,destinationNode:e}),onSubmit:()=>void C(),progressText:T,progressErrorDetail:m?.status?String(m.status.error_detail||``):void 0,includeOptions:[{value:`selected_with_sidecars`,label:`Selected + sidecars`}]})]})}function ac(e){if(Array.isArray(e))return e;let t=e;return t?.files||t?.ggufs||[]}function oc(e){return String(e.filename||e.name||e.path||`model.gguf`)}function sc(e){return oc(e).toLowerCase().includes(`mmproj`)}function cc(e){return String(e.id||e.file_id||oc(e))}function lc(e){let t=typeof e==`number`?e:Number(e||0);return!Number.isFinite(t)||t<=0?`unknown size`:t>1024**3?`${(t/1024**3).toFixed(1)} GB`:t>1024**2?`${(t/1024**2).toFixed(1)} MB`:`${t} B`}function uc(e){let t=String(e||`-`);return t.length<=78?t:`...${t.slice(-75)}`}function dc(e){return Array.isArray(e)?e:e?.nodes||[]}function fc(e){return!!(e.reachable||e.heartbeat_fresh)}function pc(e){let t=new URLSearchParams;return t.set(`model`,e),t.set(`target`,`auto`),t.set(`mode`,`direct`),t.set(`source`,`gguf-library`),t.toString()}function mc({files:e,value:t,onChange:n}){let r=e.filter(e=>oc(e).toLowerCase().includes(`mmproj`)),i=r.some(e=>e.path===t);return(0,R.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:`0.25rem`},children:[r.length>0?(0,R.jsxs)(`select`,{value:i?t:``,onChange:e=>{e.target.value&&n(e.target.value)},children:[(0,R.jsx)(`option`,{value:``,children:`— pick from library —`}),r.map(e=>(0,R.jsx)(`option`,{value:e.path,children:oc(e)},e.path))]}):null,(0,R.jsx)(`input`,{placeholder:`Or type a full path to mmproj file…`,value:i?``:t,onChange:e=>n(e.target.value)})]})}async function hc(e){let t=e===`controller`?hi():Promise.resolve({nodes:[]}),[n,r,i]=await Promise.allSettled([da(),mi(),t]);return{files:n.status===`fulfilled`?ac(n.value):[],nodeSnapshots:r.status===`fulfilled`?dc(r.value):[],nodeGgufSnapshots:i.status===`fulfilled`?dc(i.value):[]}}function gc(){let e=wn(),t=Yi(),{data:n,loading:r,error:i,refresh:a,setError:o}=ua(()=>hc(t),{files:[],nodeSnapshots:[],nodeGgufSnapshots:[]},[t]),{files:s,nodeSnapshots:c,nodeGgufSnapshots:l}=n,[u,d]=(0,v.useState)(null),[f,p]=(0,v.useState)(``),[m,h]=(0,v.useState)(8080),[g,_]=(0,v.useState)(4096),[y,b]=(0,v.useState)(0),[x,S]=(0,v.useState)(``),[C,w]=(0,v.useState)(`auto`),[T,E]=(0,v.useState)(2048),[D,O]=(0,v.useState)(!1),[k,A]=(0,v.useState)(``),[ee,j]=(0,v.useState)(!1),[M,te]=(0,v.useState)(!1),[N,P]=(0,v.useState)([]),[F,ne]=(0,v.useState)(``),[re,ie]=(0,v.useState)(``),[I,ae]=(0,v.useState)(`selected_with_sidecars`),[L,oe]=(0,v.useState)(``),se=(0,v.useMemo)(()=>s.filter(e=>!!e.registered&&!sc(e)),[s]),ce=(0,v.useMemo)(()=>s.filter(e=>!e.registered&&!sc(e)),[s]);function le(e){d(e),p(Ka(e)),S(typeof e.model_prompt_template==`string`?e.model_prompt_template:qa(e)),O(!!e.vision),A(typeof e.mmproj==`string`?e.mmproj:``),e.registered&&(typeof e.model_port==`number`&&h(e.model_port),typeof e.model_ctx==`number`&&_(e.model_ctx),typeof e.model_gpu_layers==`number`&&b(e.model_gpu_layers),typeof e.model_reasoning==`string`&&w(e.model_reasoning),typeof e.model_reasoning_budget==`number`&&E(e.model_reasoning_budget))}function ue(e,t){d({...t,source_node:e}),ne(e),ie(``),oe(``)}function fe(e){d(e),h(typeof e.model_port==`number`?e.model_port:m),_(typeof e.model_ctx==`number`?e.model_ctx:4096),b(typeof e.model_gpu_layers==`number`?e.model_gpu_layers:0),S(typeof e.model_prompt_template==`string`?e.model_prompt_template:``),w(typeof e.model_reasoning==`string`?e.model_reasoning:`auto`),E(typeof e.model_reasoning_budget==`number`?e.model_reasoning_budget:2048),O(!!e.vision),A(typeof e.mmproj==`string`?e.mmproj:``),j(!0)}async function he(){u&&(await fa(cc(u),{name:f||Ka(u),port:m,ctx:g,gpu_layers:y,host:`127.0.0.1`,reasoning:C,reasoning_budget:T,prompt_template:x||null,vision:D,mmproj:k||null}),d(null),h(m+1),await a())}async function ge(){u?.registered_as&&(await pa(String(u.registered_as),{vision:D,mmproj:k||null,ctx:g,gpu_layers:y,port:m,prompt_template:x||null,reasoning:C,reasoning_budget:T}),j(!1),d(null),await a())}async function _e(){u?.registered_as&&(await ha(String(u.registered_as)),d(null),await a())}async function U(){u&&(await ma(cc(u)),d(null),await a())}async function ve(e){te(!0),oe(``),o(``);try{let t=dc(await pi());P(t);let n=t.filter(e=>e.name&&fc(e)),r=e||F||String(n[0]?.name||``),i=re||String(n.find(e=>e.name!==r)?.name||``);ne(r),ie(i)}catch(e){o(e instanceof Error?e.message:`Failed to load transfer nodes`)}}async function ye(){if(!(!u||!F||!re)){o(``);try{let e=await ga(F,{destination_node:re,source_file_id:cc(u),include:I});oe(`Transfer ${String(e.id||``)} ${String(e.status||`queued`)}`.trim())}catch(e){o(e instanceof Error?e.message:`Failed to start transfer`)}}}async function be(e){e.registered_as&&(await ha(String(e.registered_as)),await a())}function xe(t){let n=oc(t),r=Za(t);return(0,R.jsx)(Ba,{model:{...t,status:t.registered?`added`:`discovered`},onOpen:()=>le(t),onAdd:t.registered?void 0:()=>le(t),onEdit:t.registered?()=>fe(t):void 0,onChat:t.registered?()=>e(`/ui/chat?${pc(n)}`):void 0,onTransfer:t.registered&&we?()=>{d(t),ve()}:void 0,onDelete:t.registered?()=>void be(t):void 0,children:r?(0,R.jsx)(H,{tone:`warning`,children:r}):null},cc(t))}let Se=!!u?.registered,Ce=Se?`Send Model`:`Transfer GGUF`,we=t!==`agent`,Te=t!==`controller`;return(0,R.jsxs)(`div`,{className:`gguf-library-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Files`}),(0,R.jsx)(`h2`,{children:`GGUF Library`})]}),(0,R.jsx)(z,{type:`button`,onClick:a,disabled:r,children:r?`Refreshing`:`Refresh`})]}),(0,R.jsx)(pe,{message:i}),(0,R.jsxs)(`div`,{className:`library-sections`,children:[t!==`controller`&&se.length?(0,R.jsx)(V,{title:`Added Models`,eyebrow:`Configured`,children:(0,R.jsx)(`div`,{className:`library-cards`,children:se.map(xe)})}):null,t===`controller`?null:(0,R.jsx)(V,{title:`Available GGUF Files`,eyebrow:`Discovered`,children:(0,R.jsx)(`div`,{className:`library-cards`,children:ce.length?ce.map(xe):(0,R.jsx)(de,{message:r?`Loading GGUF files...`:`All discovered files are already added.`})})}),t===`agent`?null:(0,R.jsx)(V,{title:`Agent Node GGUF Files`,eyebrow:`Connected Nodes`,children:l.length===0?(0,R.jsx)(de,{message:r?`Loading node GGUF files...`:`No agent GGUF files reported.`}):(0,R.jsx)(`div`,{className:`node-model-sections`,children:l.map(e=>{let t=String(e.name||`unknown`),n=Array.isArray(e.files)?e.files:[];return(0,R.jsxs)(`div`,{className:`node-model-group`,children:[(0,R.jsxs)(`div`,{className:`node-model-group-header`,children:[(0,R.jsx)(`strong`,{children:t}),(0,R.jsx)(H,{tone:e.reachable?`success`:`muted`,children:e.reachable?`reachable`:`unreachable`})]}),(0,R.jsx)(`div`,{className:`library-cards`,children:n.length?n.filter(e=>!sc(e)).map(e=>(0,R.jsx)(Ba,{model:{...e,status:e.registered?`added`:`discovered`},resolvedNode:t,onOpen:()=>ue(t,e),onTransfer:()=>{ue(t,e),ve(t)}},`${t}-${cc(e)}`)):(0,R.jsx)(de,{message:String(e.error||(e.reachable?`No GGUF files reported.`:`Stale heartbeat — no GGUF data.`))})})]},t)})})}),t===`agent`?null:(0,R.jsx)(V,{title:`Agent Node Models`,eyebrow:`Connected Nodes`,children:c.length===0?(0,R.jsx)(de,{message:r?`Loading nodes...`:`No agent nodes connected.`}):(0,R.jsx)(`div`,{className:`node-model-sections`,children:c.map(t=>{let n=String(t.name||`unknown`),r=Array.isArray(t.models)?Ja(t.models):[];return(0,R.jsxs)(`div`,{className:`node-model-group`,children:[(0,R.jsxs)(`div`,{className:`node-model-group-header`,children:[(0,R.jsx)(`strong`,{children:n}),(0,R.jsx)(H,{tone:t.reachable?`success`:`muted`,children:t.reachable?`reachable`:`unreachable`})]}),(0,R.jsx)(`div`,{className:`node-model-list`,children:r.length?r.map(t=>{let r=String(t.name||t.id||`unnamed`);return(0,R.jsxs)(`div`,{className:`node-model-item ${Sa(t)?`active`:``}`.trim(),children:[(0,R.jsx)(`span`,{className:`node-model-name`,children:r}),(0,R.jsx)(H,{tone:Sa(t)?`success`:`muted`,children:String(t.status||(Sa(t)?`running`:`available`))}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>e(`/ui/chat?${pc(r)}`),"aria-label":`Chat with ${r} on ${n}`,children:`Chat`})]},r)}):(0,R.jsx)(de,{message:String(t.error||(t.reachable?`No models reported.`:`Stale heartbeat — no model data.`))})})]},n)})})})]}),(0,R.jsx)(me,{title:u?oc(u):`Model Detail`,open:!!u&&!ee,onClose:()=>d(null),children:u?(0,R.jsxs)(`div`,{className:`library-detail`,children:[(0,R.jsxs)(`dl`,{className:`detail-list`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`Path`}),(0,R.jsx)(`dd`,{children:String(u.path||`-`)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`Directory`}),(0,R.jsx)(`dd`,{children:String(u.model_dir||`-`)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`Size`}),(0,R.jsx)(`dd`,{children:lc(u.size_bytes)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`Status`}),(0,R.jsx)(`dd`,{children:u.registered?`Added as ${u.registered_as||f}`:`Available`})]}),u.vision?(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`Vision`}),(0,R.jsx)(`dd`,{children:u.mmproj?uc(u.mmproj):`enabled (no mmproj set)`})]}):null]}),(0,R.jsxs)(`div`,{className:`library-controls`,children:[(0,R.jsx)(B,{label:`Model name`,children:(0,R.jsx)(`input`,{value:f,onChange:e=>p(e.target.value)})}),(0,R.jsx)(B,{label:`Next port`,children:(0,R.jsx)(`input`,{value:m,onChange:e=>h(Number(e.target.value||8080)),type:`number`})}),(0,R.jsx)(B,{label:`Context`,children:(0,R.jsx)(`input`,{value:g,onChange:e=>_(Number(e.target.value||4096)),type:`number`})}),(0,R.jsx)(B,{label:`GPU layers`,children:(0,R.jsx)(`input`,{value:y,onChange:e=>b(Number(e.target.value||0)),type:`number`})}),(0,R.jsx)(B,{label:`Prompt template`,children:(0,R.jsx)(`select`,{value:x,onChange:e=>S(e.target.value),children:Ta.map(e=>(0,R.jsx)(`option`,{value:e.value,children:e.label},e.value))})}),(0,R.jsx)(B,{label:`Reasoning`,children:(0,R.jsxs)(`select`,{value:C,onChange:e=>w(e.target.value),children:[(0,R.jsx)(`option`,{value:`auto`,children:`Auto`}),(0,R.jsx)(`option`,{value:`off`,children:`Off`}),(0,R.jsx)(`option`,{value:`on`,children:`On`})]})}),(0,R.jsx)(B,{label:`Think budget`,children:(0,R.jsx)(`input`,{value:T,onChange:e=>E(Number(e.target.value||2048)),type:`number`})}),(0,R.jsx)(B,{label:`Vision model`,hint:`Enables multimodal (image) input.`,children:(0,R.jsxs)(`label`,{style:{display:`flex`,alignItems:`center`,gap:`0.5rem`},children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:D,onChange:e=>O(e.target.checked)}),`Vision`]})}),D?(0,R.jsx)(B,{label:`mmproj file`,hint:`Multimodal projector sidecar (.gguf). Pick a discovered file or type a path.`,children:(0,R.jsx)(mc,{files:s,value:k,onChange:A})}):null]}),(0,R.jsxs)(`div`,{className:`modal-actions`,children:[Te?(0,R.jsx)(z,{type:`button`,onClick:()=>void he(),disabled:!!u.registered,children:`Add Model`}):null,Te?(0,R.jsx)(z,{type:`button`,onClick:()=>void _e(),disabled:!u.registered,children:`Remove Model`}):null,we?(0,R.jsx)(z,{type:`button`,onClick:()=>void ve(String(u.source_node||``)),children:Ce}):null,Te?(0,R.jsx)(z,{variant:`danger`,type:`button`,onClick:()=>void U(),children:`Delete GGUF`}):null]})]}):null}),(0,R.jsx)(me,{title:Ce,open:M,onClose:()=>te(!1),children:u?(0,R.jsxs)(`div`,{className:`library-detail`,children:[(0,R.jsxs)(`p`,{className:`muted`,children:[Se?`Send ${String(u.registered_as||oc(u))}`:`Transfer ${oc(u)}`,` from one reachable node to another.`]}),(0,R.jsxs)(`div`,{className:`library-controls`,children:[(0,R.jsx)(B,{label:`Source node`,children:(0,R.jsxs)(`select`,{value:F,onChange:e=>{ne(e.target.value),re===e.target.value&&ie(``)},children:[(0,R.jsx)(`option`,{value:``,children:`Select source`}),N.filter(fc).map(e=>(0,R.jsx)(`option`,{value:e.name,children:e.name},e.name))]})}),(0,R.jsx)(B,{label:`Destination node`,children:(0,R.jsxs)(`select`,{value:re,onChange:e=>ie(e.target.value),children:[(0,R.jsx)(`option`,{value:``,children:`Select destination`}),N.filter(fc).map(e=>(0,R.jsx)(`option`,{value:e.name,disabled:e.name===F,children:e.name},e.name))]})}),(0,R.jsx)(B,{label:`Include files`,children:(0,R.jsxs)(`select`,{value:I,onChange:e=>ae(e.target.value),children:[(0,R.jsx)(`option`,{value:`selected_with_sidecars`,children:`Selected + sidecars`}),(0,R.jsx)(`option`,{value:`selected_only`,children:`Selected only`})]})})]}),L?(0,R.jsx)(H,{tone:`success`,children:L}):null,(0,R.jsx)(`div`,{className:`modal-actions`,children:(0,R.jsx)(z,{type:`button`,onClick:()=>void ye(),disabled:!F||!re||F===re,children:`Start Transfer`})})]}):null}),(0,R.jsx)(me,{title:u?`Edit — ${String(u.registered_as||oc(u))}`:`Edit Model`,open:ee,onClose:()=>{j(!1),d(null)},children:u?(0,R.jsxs)(`div`,{className:`library-detail`,children:[(0,R.jsxs)(`div`,{className:`library-controls`,children:[(0,R.jsx)(B,{label:`Port`,children:(0,R.jsx)(`input`,{value:m,onChange:e=>h(Number(e.target.value||8080)),type:`number`})}),(0,R.jsx)(B,{label:`Context`,children:(0,R.jsx)(`input`,{value:g,onChange:e=>_(Number(e.target.value||4096)),type:`number`})}),(0,R.jsx)(B,{label:`GPU layers`,children:(0,R.jsx)(`input`,{value:y,onChange:e=>b(Number(e.target.value||0)),type:`number`})}),(0,R.jsx)(B,{label:`Prompt template`,children:(0,R.jsx)(`select`,{value:x,onChange:e=>S(e.target.value),children:Ta.map(e=>(0,R.jsx)(`option`,{value:e.value,children:e.label},e.value))})}),(0,R.jsx)(B,{label:`Reasoning`,children:(0,R.jsxs)(`select`,{value:C,onChange:e=>w(e.target.value),children:[(0,R.jsx)(`option`,{value:`auto`,children:`Auto`}),(0,R.jsx)(`option`,{value:`off`,children:`Off`}),(0,R.jsx)(`option`,{value:`on`,children:`On`})]})}),(0,R.jsx)(B,{label:`Think budget`,children:(0,R.jsx)(`input`,{value:T,onChange:e=>E(Number(e.target.value||2048)),type:`number`})}),(0,R.jsx)(B,{label:`Vision model`,hint:`Enables multimodal (image) input.`,children:(0,R.jsxs)(`label`,{style:{display:`flex`,alignItems:`center`,gap:`0.5rem`},children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:D,onChange:e=>O(e.target.checked)}),`Vision`]})}),D?(0,R.jsx)(B,{label:`mmproj file`,hint:`Multimodal projector sidecar (.gguf). Pick a discovered file or type a path.`,children:(0,R.jsx)(mc,{files:s,value:k,onChange:A})}):null]}),(0,R.jsxs)(`div`,{className:`modal-actions`,children:[(0,R.jsx)(z,{type:`button`,variant:`primary`,onClick:()=>void ge(),children:`Save`}),(0,R.jsx)(z,{type:`button`,variant:`ghost`,onClick:()=>{j(!1),d(null)},children:`Cancel`})]})]}):null})]})}function _c(){return j(`/conversions/models`)}function vc(e,t){return M(`/conversions/${encodeURIComponent(e)}/start`,t)}function yc(e){if(Array.isArray(e))return e;let t=e;return t?.models||t?.conversions||[]}function bc(e,t,n=`-`){return String(e[t]||n)}function xc(e){return e.running?`running pid ${bc(e,`pid`,`?`)}`:e.convertible?`ready`:`not convertible`}function Sc(e){let t=Array.isArray(e.gguf_files)?e.gguf_files:[];return t.length?`${t.length} file${t.length===1?``:`s`}`:`missing`}function Cc(){let{data:e,loading:t,error:n,refresh:r}=ua(()=>_c().then(yc),[]),i=(0,v.useMemo)(()=>e.filter(e=>!!e.convertible),[e]);async function a(e){await vc(e,void 0),await r()}return(0,R.jsxs)(`div`,{className:`hf-to-gguf-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Conversion`}),(0,R.jsx)(`h2`,{children:`HF to GGUF`})]}),(0,R.jsx)(z,{type:`button`,onClick:r,disabled:t,children:t?`Refreshing`:`Refresh`})]}),(0,R.jsx)(pe,{message:n}),(0,R.jsx)(V,{title:`Convertible HF Models`,eyebrow:`Source models`,children:i.length===0&&t?(0,R.jsx)(de,{message:`Loading convertible HF models...`}):(0,R.jsx)(fe,{rows:i,emptyMessage:`No convertible HF models found.`,getRowKey:(e,t)=>bc(e,`name`,String(t)),columns:[{key:`name`,header:`Model`,render:e=>(0,R.jsx)(`strong`,{children:bc(e,`name`)})},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:e.running?`warning`:e.convertible?`success`:`danger`,children:xc(e)})},{key:`gguf`,header:`GGUF`,render:Sc},{key:`path`,header:`Path`,render:e=>bc(e,`path`)},{key:`output`,header:`Output`,render:e=>bc(e,`output_path`)},{key:`python`,header:`Python`,render:e=>bc(e,`python_bin`)},{key:`actions`,header:`Actions`,render:e=>{let t=bc(e,`name`);return(0,R.jsx)(`div`,{className:`actions`,children:(0,R.jsx)(z,{type:`button`,onClick:()=>void a(t),disabled:!(e.convertible&&!e.running),"aria-label":`Convert ${t}`,children:`Convert`})})}}]})})]})}function wc(e){return M(`/jobs`,e)}function Tc(e){return j(e?`/jobs?limit=${e}`:`/jobs`)}function Ec(e){return j(`/jobs/${encodeURIComponent(e)}`)}function Dc(e){return M(`/jobs/${encodeURIComponent(e)}/cancel`)}function Oc(e,t=200){return j(`/jobs/${encodeURIComponent(e)}/events?limit=${t}`)}function kc(e){return j(`/jobs/${encodeURIComponent(e)}/artifacts`)}function Ac(){return j(`/controller/stats`)}function jc(){return j(`/controller/retention-policy`)}function Mc(e){return M(`/controller/archive/export`,e)}function Nc(e=200){return j(`/downloads/history?limit=${e}`)}function Pc(e,t=``){let n=new URLSearchParams({repo_id:e});return t&&n.set(`revision`,t),j(`/downloads/quants?${n.toString()}`)}function Fc(){return j(`/downloads/recommendations`)}function Ic(e,t){return M(`/downloads/${e}/start`,t)}function Lc(e){return M(`/downloads/${encodeURIComponent(e)}/cancel`)}function Rc(e){return F(`/downloads/${encodeURIComponent(e)}`)}function zc({item:e,inventory:t,canSend:n,onSend:r,onDownload:i}){let a=t.remoteSource;return(0,R.jsxs)(`article`,{className:`model-card recommended-download-card`,children:[(0,R.jsx)(`strong`,{children:e.title}),(0,R.jsx)(`span`,{children:e.fitLabel}),(0,R.jsx)(`small`,{children:e.repoId}),(0,R.jsxs)(`div`,{className:`recommended-download-meta`,children:[(0,R.jsx)(`span`,{children:e.quant}),(0,R.jsx)(`span`,{children:e.includeFile}),e.mmprojFile?(0,R.jsx)(`span`,{children:e.mmprojFile}):null,(0,R.jsx)(`span`,{children:t.label})]}),(0,R.jsx)(`p`,{children:e.useCase}),(0,R.jsx)(`small`,{children:e.fitReason}),(0,R.jsxs)(`small`,{children:[`Path: `,t.detail]}),t.status===`local`?(0,R.jsx)(z,{disabled:!0,children:`Available locally`}):a&&n?(0,R.jsx)(z,{type:`button`,onClick:()=>r(e,a),"aria-label":`Send ${e.title}`,children:`Send`}):(0,R.jsx)(z,{type:`button`,onClick:()=>i(e),"aria-label":`Download ${e.title}`,children:`Download`})]})}function K(e,t,n=`-`){return String(e[t]||n)}function Bc(e,t,n){let r=new Blob([t],{type:n}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=e,a.click(),URL.revokeObjectURL(i)}function Vc(e){return Array.isArray(e)?e:e?.models||[]}function Hc(e){if(Array.isArray(e))return e;let t=e?.downloads;return Array.isArray(t)?t:[]}function Uc(e){if(Array.isArray(e))return e;let t=e?.quants||e?.files;return Array.isArray(t)?t:[]}function Wc(e){if(Array.isArray(e))return e;let t=e?.files||e?.ggufs;return Array.isArray(t)?t:[]}function Gc(e){let t=Array.isArray(e)?e:e?.nodes;return Array.isArray(t)?t:[]}function Kc(e){return String(e.path||e.filename||`model.gguf`)}function qc(e,t=``){return(t||e.split(`/`).pop()||`model`).replace(/\.gguf$/i,``).replace(/[^A-Za-z0-9._-]+/g,`-`).replace(/^-+|-+$/g,``)||`model`}function Jc(e){let t=e.mmproj_file;if(typeof t==`string`&&t)return t;let n=e.mmproj;if(n&&typeof n==`object`){let e=n.path||n.filename;if(typeof e==`string`&&e)return e}return null}function Yc(e){return[e.filename,e.path,e.model_path,e.model,e.name].filter(Boolean).join(` `).toLowerCase()}function Xc(e,t){let n=t.includeFile.toLowerCase();return Yc(e).includes(n)}function Zc(e){let t=Number(e);return Number.isFinite(t)&&t>=0?t:null}function Qc(e){let t=Zc(e);if(t==null)return`-`;if(t<1024)return`${t} B`;let n=[`KB`,`MB`,`GB`,`TB`],r=t/1024,i=n[0];for(let e=1;e<n.length&&r>=1024;e+=1)r/=1024,i=n[e];return`${r>=10?Math.round(r):Math.round(r*10)/10} ${i}`}function $c(e){let t=Zc(e.progress_percent);if(t!=null)return Math.max(0,Math.min(100,Math.round(t)));let n=Zc(e.bytes_downloaded),r=Zc(e.bytes_total);return n==null||r==null||r<=0?null:Math.max(0,Math.min(100,Math.round(n/r*100)))}function el(e){let t=Zc(e.bytes_downloaded),n=Zc(e.bytes_total);return t==null&&n==null?e.status===`running`?`Downloading`:`-`:n==null||n<=0?`${Qc(t)} downloaded`:`${Qc(t)} / ${Qc(n)}`}function tl({record:e}){let t=$c(e),n=el(e);return(0,R.jsxs)(`div`,{className:`download-progress`,children:[(0,R.jsxs)(`div`,{className:`download-progress-line`,children:[(0,R.jsx)(`span`,{children:t==null?e.status===`running`?`Running`:`-`:`${t}%`}),(0,R.jsx)(`small`,{children:n})]}),t==null?null:(0,R.jsx)(`div`,{className:`download-progress-track`,"aria-label":`Download progress ${t}%`,children:(0,R.jsx)(`span`,{style:{width:`${t}%`}})})]})}function nl(e){let t=e?.recommendations;return Array.isArray(t)?t.map(e=>({repoId:e.repo_id,title:e.title,includeFile:e.include_file,mmprojFile:e.mmproj_file||null,vision:!!(e.vision||e.mmproj_file),quant:e.quant,fitLabel:e.fit_label,useCase:e.use_case,fitReason:e.fit_reason,score:e.score})):[]}function rl(e){let t=e?.machine,n=Number(t?.ram_gb||0),r=Number(t?.vram_gb||0),i=String(t?.platform||``),a=String(t?.architecture||``);return n||r?!r&&i.toLowerCase()===`darwin`&&[`arm64`,`aarch64`].includes(a.toLowerCase())?`${Math.round(n||0)} GB Apple unified memory detected`:`${Math.round(n||0)} GB RAM${r?`, ${Math.round(r)} GB VRAM`:``} detected`:`Conservative picks shown until hardware details are available.`}function il(e){if(e==null||e===``)return`-`;let t=String(e).trim();if(!t)return`-`;let n=new Date(t);return Number.isNaN(n.getTime())?t:n.toLocaleString(void 0,{year:`numeric`,month:`short`,day:`2-digit`,hour:`2-digit`,minute:`2-digit`})}function al(e,t,n){let r=t.find(t=>Xc(t,e));if(r)return{status:`local`,label:`On this machine`,detail:String(r.path||r.filename||e.includeFile),remoteSource:null};for(let t of n){if(!t?.reachable||!t.name||!Array.isArray(t.models))continue;let n=t.models.find(t=>Xc(t,e)&&Oa(t));if(n)return{status:`remote`,label:`Elsewhere in fleet`,detail:`${t.name} has ${W(n)}`,remoteSource:{node:t.name,modelName:W(n),fileId:Oa(n)}}}return{status:`missing`,label:`Missing`,detail:`Not found locally or on reachable nodes`,remoteSource:null}}async function ol(){let[e,t,n,r]=await Promise.all([Nc(),Fc().then(e=>({payload:e,error:``})).catch(e=>({payload:null,error:e instanceof Error?e.message:`Recommendations unavailable`})),da().catch(()=>[]),mi().catch(()=>[])]);return{downloads:Hc(e),recommendationPayload:t.payload,recommendationError:t.error,localGgufs:Wc(n),nodes:Gc(r)}}function sl(){let e=Yi(),[t,n]=(0,v.useState)(null),[r,i]=(0,v.useState)(``),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(``),[d,f]=(0,v.useState)(`8080`),[p,m]=(0,v.useState)([]),[h,g]=(0,v.useState)(`Select a repo to query remote GGUF quants.`),{data:_,loading:y,error:b,refresh:x}=ua(ol,{downloads:[],recommendationPayload:null,recommendationError:``,localGgufs:[],nodes:[]}),{downloads:S,recommendationPayload:C,recommendationError:w,localGgufs:T,nodes:E}=_;(0,v.useEffect)(()=>{if(!S.some(e=>e.status===`running`))return;let e=window.setInterval(()=>{x()},1500);return()=>window.clearInterval(e)},[S,x]);async function D(){if(!r.trim()){g(`Enter a repo id first.`);return}g(`Querying Hugging Face...`),m([]);try{let e=Uc(await Pc(r.trim(),a.trim()));m(e),g(e.length?`${e.length} remote GGUF quant${e.length===1?``:`s`} found.`:`No remote GGUF quants found.`)}catch(e){g(e instanceof Error?e.message:`Quant discovery failed`)}}async function O(t=r,n=``,i=null){if(!t.trim())return;let o={revision:a.trim()||null,include_file:n||null};i&&(o.mmproj_file=i),e===`controller`&&s?await wc({type:`model.install`,target:`node:${s}`,payload:{repo_id:t.trim(),...o,model_name:l.trim()||qc(t.trim(),n),port:Number(d)||8080,ctx:4096,gpu_layers:0,start:!0}}):await Ic(t.trim(),o),await x()}async function k(e){e.preventDefault(),await O(r)}async function A(e){await Lc(e),await x()}async function ee(e){await Rc(e),await x()}function j(e,t){n({item:e,source:t,destinationNode:Xa(E,t.node)[0]?.name||``,status:``,submitting:!1})}async function M(){if(t?.destinationNode){n({...t,submitting:!0,status:``});try{let e=await ga(t.source.node,{destination_node:t.destinationNode,source_file_id:t.source.fileId,include:`selected_only`});n({...t,submitting:!1,status:`Transfer ${e.id||``} queued`.replace(`  `,` `).trim()})}catch(e){n({...t,submitting:!1,status:e instanceof Error?e.message:`Transfer failed`})}}}let te=nl(C),N=te.filter(e=>!T.some(t=>Xc(t,e))),P=te.length>0&&N.length===0&&!w,F=rl(C),ne=E.filter(e=>e.name&&e.reachable).sort((e,t)=>String(e.name).localeCompare(String(t.name)));return(0,R.jsxs)(`div`,{className:`hf-downloads-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Acquisition`}),(0,R.jsx)(`h2`,{children:`HF Downloads`})]}),(0,R.jsx)(z,{type:`button`,onClick:()=>void x(),disabled:y,children:y?`Refreshing`:`Refresh`})]}),(0,R.jsx)(pe,{message:b}),(0,R.jsxs)(V,{className:`download-panel`,children:[(0,R.jsxs)(`section`,{className:`recommended-downloads`,"aria-label":`Recommended model downloads`,children:[(0,R.jsx)(`div`,{className:`recommended-downloads-header`,children:(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`h3`,{children:`Recommended for this machine`}),(0,R.jsx)(`p`,{className:`muted`,children:F}),w?(0,R.jsx)(`p`,{className:`muted`,children:`Recommendations are unavailable. Manual downloads still work.`}):null]})}),(0,R.jsxs)(`div`,{className:`recommended-download-cards`,children:[P?(0,R.jsx)(`p`,{className:`muted`,children:`All recommended models are already available locally.`}):null,N.map(e=>{let t=al(e,T,E);return(0,R.jsx)(zc,{item:e,inventory:t,canSend:t.remoteSource?Xa(E,t.remoteSource.node).length>0:!1,onSend:j,onDownload:e=>void O(e.repoId,e.includeFile,e.mmprojFile)},`${e.repoId}:${e.includeFile}`)})]})]}),(0,R.jsxs)(`form`,{className:`filter-bar download-form`,onSubmit:k,children:[(0,R.jsx)(B,{label:`Repo ID`,children:(0,R.jsx)(`input`,{value:r,onChange:e=>i(e.target.value),placeholder:`owner/model`})}),(0,R.jsx)(B,{label:`Revision`,children:(0,R.jsx)(`input`,{value:a,onChange:e=>o(e.target.value),placeholder:`revision (optional)`})}),e===`controller`?(0,R.jsx)(B,{label:`Target node`,children:(0,R.jsxs)(`select`,{value:s,onChange:e=>c(e.target.value),children:[(0,R.jsx)(`option`,{value:``,children:`This controller`}),ne.map(e=>(0,R.jsx)(`option`,{value:e.name,children:e.name},e.name))]})}):null,e===`controller`&&s?(0,R.jsxs)(R.Fragment,{children:[(0,R.jsx)(B,{label:`Model alias`,children:(0,R.jsx)(`input`,{value:l,onChange:e=>u(e.target.value),placeholder:qc(r)})}),(0,R.jsx)(B,{label:`Port`,children:(0,R.jsx)(`input`,{type:`number`,min:1024,max:65535,value:d,onChange:e=>f(e.target.value)})})]}):null,(0,R.jsx)(z,{type:`button`,onClick:()=>void D(),children:`Find Quants`}),(0,R.jsx)(z,{type:`submit`,children:`Download`}),(0,R.jsx)(`span`,{className:`muted download-form-status`,children:h})]}),(0,R.jsx)(`div`,{className:`download-quant-cards`,children:p.map(e=>{let t=Kc(e),n=Jc(e);return(0,R.jsxs)(`article`,{className:`model-card download-quant-card`,children:[(0,R.jsx)(`strong`,{children:K(e,`filename`,t)}),(0,R.jsx)(`span`,{children:t}),n?(0,R.jsx)(`span`,{children:n}):null,(0,R.jsx)(`small`,{children:K(e,`size`,`unknown size`)}),(0,R.jsx)(z,{type:`button`,onClick:()=>void O(r,t,n),"aria-label":`Download ${t}`,children:`Download`})]},t)})})]}),(0,R.jsx)(V,{title:`Download History`,children:S.length===0?(0,R.jsx)(de,{message:y?`Loading downloads...`:`No download history yet.`}):(0,R.jsx)(fe,{rows:S,emptyMessage:`No download history yet.`,getRowKey:(e,t)=>String(e.id||t),columns:[{key:`repo`,header:`Repo`,render:e=>K(e,`repo_id`)},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:e.status===`running`?`warning`:e.status===`complete`?`success`:`muted`,children:K(e,`status`)})},{key:`progress`,header:`Progress`,render:e=>(0,R.jsx)(tl,{record:e})},{key:`started`,header:`Started`,render:e=>il(e.started_at)},{key:`finished`,header:`Finished`,render:e=>il(e.finished_at)},{key:`path`,header:`Path`,render:e=>K(e,`local_path`,K(e,`path`))},{key:`by`,header:`By`,render:e=>K(e,`triggered_by`)},{key:`actions`,header:`Actions`,render:e=>{let t=String(e.id||``),n=K(e,`repo_id`);return(0,R.jsxs)(`div`,{className:`actions`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>void O(n),"aria-label":`Download ${n}`,children:`Download`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void A(t),disabled:e.status!==`running`,"aria-label":`Stop ${n}`,children:`Stop`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void ee(t),disabled:e.status===`running`,"aria-label":`Delete ${n}`,children:`Delete`})]})}}]})}),(0,R.jsx)(me,{title:t?`Send ${t.item.title}`:`Send Model`,open:!!t,onClose:()=>n(null),children:t?(0,R.jsxs)(`div`,{className:`library-detail`,children:[(0,R.jsxs)(`p`,{className:`muted`,children:[`Send `,t.item.includeFile,` from `,t.source.node,`.`]}),(0,R.jsxs)(`dl`,{className:`detail-list`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`Source`}),(0,R.jsx)(`dd`,{children:t.source.node})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`dt`,{children:`File ID`}),(0,R.jsx)(`dd`,{children:t.source.fileId})]})]}),(0,R.jsx)(B,{label:`Destination node`,children:(0,R.jsx)(`select`,{value:t.destinationNode,onChange:e=>n({...t,destinationNode:e.target.value}),children:Xa(E,t.source.node).map(e=>(0,R.jsx)(`option`,{value:e.name,children:e.name},e.name))})}),t.status?(0,R.jsx)(`p`,{className:`muted`,children:t.status}):null,(0,R.jsx)(`div`,{className:`modal-actions`,children:(0,R.jsx)(z,{type:`button`,onClick:()=>void M(),disabled:!t.destinationNode||t.submitting,children:t.submitting?`Sending`:`Start Transfer`})})]}):null})]})}function cl(){return j(`/quantizations/files`)}function ll(e,t){return M(`/quantizations/${encodeURIComponent(e)}/start`,t)}var ul=[`Q4_K_M`],dl=/(?:^|[-._])(?:Q[2-8](?:_[0-9A-Z]+)*|IQ[1-4](?:_[0-9A-Z]+)*|TQ[1-2](?:_[0-9A-Z]+)*)\.gguf$/i;function fl(e){return Array.isArray(e)?e:e?.files||[]}function pl(e,t,n=`-`){return String(e[t]||n)}function ml(e){return pl(e,`id`,pl(e,`filename`))}function hl(e){return pl(e,`filename`,pl(e,`name`,ml(e)))}function gl(e){return dl.test(hl(e))}function _l(e){let t=Number(e.size_gb||0);return Number.isFinite(t)&&t>0?t:0}function vl(e){return e>0?`${e.toFixed(1)} GB`:`-`}function yl(e){return Array.isArray(e.supported_types)&&e.supported_types.length?e.supported_types.map(String):ul}function bl(e){return e.running?`running pid ${pl(e,`pid`,`?`)}`:e.quantize_bin?`ready`:`missing binary`}function xl(e){let t=e.toUpperCase();return t.startsWith(`Q2`)?2.5:t.startsWith(`Q3`)?3.5:t.startsWith(`Q4`)?4.5:t.startsWith(`Q5`)?5.5:t.startsWith(`Q6`)?6.5:t.startsWith(`Q8`)?8.5:t.includes(`F16`)?16:6}function Sl(e){return Number((16/xl(e)).toFixed(2))}function Cl(e,t,n,r){let i=e.flatMap(e=>yl(e).map(i=>{let a=_l(e),o=a*(xl(i)/16),s=o<=t*.85,c=s?20:-50;return n===`low`&&(c+=Sl(i)*8),n===`balanced`&&(c+=Sl(i)*4),r===`high`&&(c+=xl(i)*1.8),r===`max`&&(c+=xl(i)*2.6),r===`balanced`&&(c+=xl(i)*1.2),{file:hl(e),type:i,source_gb:Number(a.toFixed(2)),est_size_gb:Number(o.toFixed(2)),throughput_factor:Sl(i),fits_vram:s,score:Number(c.toFixed(2))}})).sort((e,t)=>t.score-e.score);return JSON.stringify({inputs:{vram_gb:t,latency_goal:n,quality_goal:r},recommendation:i[0]||null,top_candidates:i.slice(0,5),notes:[`Memory estimate approximates quant bits vs FP16 baseline and is not exact.`,`Throughput factor is a relative heuristic, not measured tokens/sec.`]},null,2)}function wl(){let{data:e,loading:t,error:n,refresh:r}=ua(()=>cl().then(fl),[]),[i,a]=(0,v.useState)({}),[o,s]=(0,v.useState)(16),[c,l]=(0,v.useState)(`balanced`),[u,d]=(0,v.useState)(`balanced`),[f,p]=(0,v.useState)(`Run the advisor after files load.`),m=(0,v.useMemo)(()=>{let t={};for(let n of e)t[ml(n)]=i[ml(n)]||String(n.type||yl(n)[0]);return t},[e,i]),h=(0,v.useMemo)(()=>e.filter(e=>!gl(e)),[e]);async function g(e){await ll(ml(e),{type:m[ml(e)]||yl(e)[0]}),await r()}return(0,R.jsxs)(`div`,{className:`quantization-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Optimization`}),(0,R.jsx)(`h2`,{children:`Quantization`})]}),(0,R.jsx)(z,{type:`button`,onClick:r,disabled:t,children:t?`Refreshing`:`Refresh`})]}),(0,R.jsx)(pe,{message:n}),(0,R.jsxs)(`div`,{className:`flex`,children:[(0,R.jsx)(V,{title:`Advisor`,eyebrow:`Heuristic`,className:`side-panel`,children:(0,R.jsxs)(`div`,{className:`stacked-controls`,children:[(0,R.jsxs)(`div`,{className:`recommendation-form`,children:[(0,R.jsx)(B,{label:`Target VRAM (GB)`,children:(0,R.jsx)(`input`,{value:o,onChange:e=>s(Number(e.target.value||0)),type:`number`})}),(0,R.jsx)(B,{label:`Latency Goal`,children:(0,R.jsxs)(`select`,{value:c,onChange:e=>l(e.target.value),children:[(0,R.jsx)(`option`,{value:`low`,children:`Low`}),(0,R.jsx)(`option`,{value:`balanced`,children:`Balanced`}),(0,R.jsx)(`option`,{value:`throughput`,children:`Throughput`})]})}),(0,R.jsx)(B,{label:`Quality Goal`,children:(0,R.jsxs)(`select`,{value:u,onChange:e=>d(e.target.value),children:[(0,R.jsx)(`option`,{value:`balanced`,children:`Balanced`}),(0,R.jsx)(`option`,{value:`high`,children:`High`}),(0,R.jsx)(`option`,{value:`max`,children:`Max`})]})}),(0,R.jsx)(z,{type:`button`,className:`btn btn-primary`,onClick:()=>p(Cl(h,o,c,u)),children:`Recommend`})]}),(0,R.jsx)(`pre`,{className:`detail-json`,children:f})]})}),(0,R.jsx)(V,{title:`Quantization Files`,eyebrow:`Source GGUFs`,children:h.length===0&&t?(0,R.jsx)(de,{message:`Loading quantization files...`}):(0,R.jsx)(fe,{rows:h,emptyMessage:`No GGUF files found for quantization.`,getRowKey:(e,t)=>ml(e)||String(t),columns:[{key:`file`,header:`File`,render:e=>hl(e)},{key:`size`,header:`Size`,render:e=>vl(_l(e))},{key:`type`,header:`Type`,render:e=>{let t=ml(e);return(0,R.jsx)(`select`,{className:`compact-select`,"aria-label":`Quant type for ${hl(e)}`,value:m[t]||yl(e)[0],onChange:e=>a(n=>({...n,[t]:e.target.value})),children:yl(e).map(e=>(0,R.jsx)(`option`,{value:e,children:e},e))})}},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:e.running?`warning`:e.quantize_bin?`success`:`danger`,children:bl(e)})},{key:`output`,header:`Output`,render:e=>pl(e,`output_path`)},{key:`actions`,header:`Actions`,render:e=>{let t=hl(e);return(0,R.jsx)(`button`,{type:`button`,className:`btn btn-primary`,onClick:()=>void g(e),disabled:!e.quantize_bin||!!e.running,"aria-label":`Quantize ${t}`,children:`Quantize`})}}]})})]})]})}function Tl(e,t){if(Array.isArray(e))return e;if(t){let n=e?.[t];if(Array.isArray(n))return n}return[]}function El(e){return K(e,`id`)}function Dl(e){let t=El(e);return t.length>8?t.slice(0,8):t}function Ol(e){let t=String(e||``).toLowerCase();return[`succeeded`,`complete`,`completed`].includes(t)?`success`:[`running`,`queued`,`pending`,`cancel_requested`].includes(t)?`warning`:[`failed`,`error`,`cancelled`,`canceled`].includes(t)?`danger`:`muted`}function kl(e){return JSON.stringify(e||{},null,2)}async function Al(){let[e,t,n,r,i]=await Promise.all([pi(),mi(),Tc(50),Ac(),jc()]);return{nodes:Ga(Tl(e,`nodes`),Tl(t,`nodes`)),jobs:Tl(n,`jobs`),stats:r,policy:i}}function jl(){let{data:e,loading:t,error:n,refresh:r,setError:i}=ua(Al,{jobs:[],nodes:[],stats:null,policy:null}),{jobs:a,nodes:o,stats:s,policy:c}=e,[l,u]=(0,v.useState)(null),[d,f]=(0,v.useState)(`No archive export run yet.`),[p,m]=(0,v.useState)(``),[h,g]=(0,v.useState)(``),[_,y]=(0,v.useState)(``),b=(0,v.useMemo)(()=>a.filter(e=>{let t=K(e,`status`,``).toLowerCase(),n=K(e,`type`,``).toLowerCase(),r=K(e,`target_selector`,`auto`).toLowerCase();return(!p||t.includes(p.toLowerCase()))&&(!h||n.includes(h.toLowerCase()))&&(!_||r.includes(_.toLowerCase()))}),[a,p,h,_]);async function x(e){let[t,n,r]=await Promise.all([Ec(e),Oc(e),kc(e)]);u({job:t,events:Tl(n),artifacts:Tl(r)})}async function S(e){await Dc(e),await r()}async function C(){let e=await Mc();f(JSON.stringify(e,null,2))}let w=o.map(e=>({name:K(e,`name`),reachable:String(!!e.reachable),models:String(Array.isArray(e.models)?e.models.length:0),source:K(e,`models_source`),heartbeat:K(e,`last_heartbeat`)}));return(0,R.jsxs)(`div`,{className:`controller-ops-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Fleet`}),(0,R.jsx)(`h2`,{children:`Controller Ops`})]}),(0,R.jsx)(z,{type:`button`,onClick:r,disabled:t,children:t?`Refreshing`:`Refresh`})]}),(0,R.jsx)(pe,{message:n}),(0,R.jsxs)(`div`,{className:`controller-grid-react`,children:[(0,R.jsxs)(V,{title:`Jobs`,eyebrow:`Queue`,children:[(0,R.jsxs)(`div`,{className:`filter-bar`,children:[(0,R.jsx)(B,{label:`Status`,children:(0,R.jsx)(`input`,{value:p,onChange:e=>m(e.target.value),placeholder:`status`})}),(0,R.jsx)(B,{label:`Type`,children:(0,R.jsx)(`input`,{value:h,onChange:e=>g(e.target.value),placeholder:`type`})}),(0,R.jsx)(B,{label:`Target`,children:(0,R.jsx)(`input`,{value:_,onChange:e=>y(e.target.value),placeholder:`target`})})]}),(0,R.jsx)(fe,{rows:b,emptyMessage:t?`Loading jobs...`:`No jobs found.`,getRowKey:(e,t)=>El(e)||String(t),columns:[{key:`id`,header:`ID`,render:e=>Dl(e)},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:Ol(e.status),children:K(e,`status`)})},{key:`type`,header:`Type`,render:e=>K(e,`type`)},{key:`target`,header:`Target`,render:e=>K(e,`target_selector`,`auto`)},{key:`updated`,header:`Updated`,render:e=>K(e,`updated_at`)},{key:`actions`,header:`Actions`,render:e=>{let t=El(e);return(0,R.jsxs)(`div`,{className:`actions`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>void x(t),"aria-label":`View ${t}`,children:`View`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void S(t),disabled:!t||[`succeeded`,`failed`,`cancelled`,`canceled`].includes(K(e,`status`,``).toLowerCase()),"aria-label":`Cancel ${t}`,children:`Cancel`})]})}}]})]}),(0,R.jsx)(V,{title:`Job Detail`,eyebrow:`Events and artifacts`,children:l?(0,R.jsxs)(`div`,{className:`job-detail-react`,children:[(0,R.jsxs)(`div`,{className:`job-detail-summary`,children:[(0,R.jsx)(`strong`,{children:K(l.job,`id`)}),(0,R.jsxs)(`span`,{className:`muted`,children:[`status=`,K(l.job,`status`),` type=`,K(l.job,`type`),` target=`,K(l.job,`target_selector`,`auto`)]}),(0,R.jsxs)(`span`,{className:`muted`,children:[`created=`,K(l.job,`created_at`),` updated=`,K(l.job,`updated_at`)]})]}),(0,R.jsx)(`h4`,{children:`Events`}),(0,R.jsx)(fe,{rows:l.events,emptyMessage:`No events.`,getRowKey:(e,t)=>`${K(e,`created_at`,`event`)}-${t}`,columns:[{key:`time`,header:`Time`,render:e=>K(e,`created_at`)},{key:`type`,header:`Type`,render:e=>K(e,`event_type`,K(e,`type`))},{key:`payload`,header:`Payload`,render:e=>(0,R.jsx)(`pre`,{className:`inline-json`,children:kl(e.event_json||e.payload||e)})}]}),(0,R.jsx)(`h4`,{children:`Artifacts`}),(0,R.jsx)(fe,{rows:l.artifacts,emptyMessage:`No artifacts.`,getRowKey:(e,t)=>`${K(e,`uri`,`artifact`)}-${t}`,columns:[{key:`kind`,header:`Kind`,render:e=>K(e,`kind`)},{key:`uri`,header:`URI`,render:e=>K(e,`uri`)},{key:`meta`,header:`Meta`,render:e=>(0,R.jsx)(`pre`,{className:`inline-json`,children:kl(e.meta||e)})}]})]}):(0,R.jsx)(`p`,{className:`muted`,children:`Select a job to inspect details, events, and artifacts.`})}),(0,R.jsx)(V,{title:`Node Capabilities`,eyebrow:`Controller inventory`,children:w.length?(0,R.jsx)(fe,{rows:w,emptyMessage:`No nodes.`,getRowKey:(e,t)=>e.name||String(t),columns:[{key:`node`,header:`Node`,render:e=>e.name},{key:`reachable`,header:`Reachable`,render:e=>e.reachable},{key:`models`,header:`Models`,render:e=>e.models},{key:`source`,header:`Source`,render:e=>e.source},{key:`heartbeat`,header:`Heartbeat`,render:e=>e.heartbeat}]}):(0,R.jsx)(de,{message:`No nodes.`})}),(0,R.jsx)(V,{title:`Retention & Archive`,eyebrow:`Policy`,children:(0,R.jsxs)(`div`,{className:`stacked-controls`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>void C(),children:`Run Archive Export`}),(0,R.jsxs)(`div`,{className:`muted`,children:[`retention_days=`,String(c?.retention_days??`-`)]}),(0,R.jsxs)(`div`,{className:`muted`,children:[`archive_retention_days=`,String(c?.archive_retention_days??`-`)]}),(0,R.jsx)(`h4`,{children:`Last Sweep`}),(0,R.jsx)(`pre`,{className:`detail-json compact-json`,children:kl(s?.last_sweep)}),(0,R.jsx)(`h4`,{children:`Job Counts`}),(0,R.jsx)(`pre`,{className:`detail-json compact-json`,children:kl(s?.job_counts)}),(0,R.jsx)(`h4`,{children:`Archive Export`}),(0,R.jsx)(`pre`,{className:`detail-json compact-json`,children:d})]})})]})]})}function Ml(e,t){return M(`/chat/${encodeURIComponent(e)}/embeddings`,t)}function Nl(e){return e.split(`
`).map(e=>e.trim()).filter(Boolean)}function Pl(e){return Array.isArray(e.embedding)?e.embedding:[]}function Fl(e,t){return String(e.id??e.index??t)}function Il(e){let t=e?.usage||{};return`prompt=${String(t.prompt_tokens??`-`)}, total=${String(t.total_tokens??`-`)}`}function Ll(e){return`${JSON.stringify(e.slice(0,8))}${e.length>8?` ...`:``}`}function Rl(e,t){if(!e.length||e.length!==t.length)return 0;let n=0,r=0,i=0;for(let a=0;a<e.length;a+=1){let o=Number(e[a]||0),s=Number(t[a]||0);n+=o*s,r+=o*o,i+=s*s}return!r||!i?0:n/(Math.sqrt(r)*Math.sqrt(i))}function zl(e){return JSON.stringify(String(e??``))}function q(e){let t=Math.min(3,e.length),n=e.slice(0,t).map(e=>[...e]),r=Array(e.length).fill(0);for(let i=0;i<5;i+=1){for(let i=0;i<e.length;i+=1){let a=0,o=-1/0;for(let r=0;r<t;r+=1){let t=Rl(e[i],n[r]);t>o&&(a=r,o=t)}r[i]=a}for(let i=0;i<t;i+=1){let t=e.filter((e,t)=>r[t]===i);if(!t.length)continue;let a=Array(t[0].length).fill(0);for(let e of t)for(let t=0;t<e.length;t+=1)a[t]+=Number(e[t]||0);n[i]=a.map(e=>e/t.length)}}return Array.from({length:t},(e,t)=>({cluster:t,size:r.filter(e=>e===t).length,members:r.map((e,t)=>({value:e,index:t})).filter(e=>e.value===t).map(e=>e.index)}))}function J(){let{data:e,error:t,setError:n}=ua(()=>_a().then(e=>Vc(e)),[]),[r,i]=(0,v.useState)(``);(0,v.useEffect)(()=>{!r&&e.length>0&&i(W(e[0]))},[e,r]);let[a,o]=(0,v.useState)(`auto`),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(null),[d,f]=(0,v.useState)([]),[p,m]=(0,v.useState)(0),[h,g]=(0,v.useState)([]),[_,y]=(0,v.useState)(`No clustering run yet.`),[b,x]=(0,v.useState)(`Ready`),S=(0,v.useMemo)(()=>l?.data||[],[l]),C=(0,v.useMemo)(()=>S.map((e,t)=>({row:e,input:d[t]||`-`,index:t})),[S,d]),w=(0,v.useMemo)(()=>S.map(Pl),[S]);async function T(){let e=Nl(s);if(!r){n(`Select an embeddings model.`);return}if(!e.length){n(`Enter at least one line.`);return}n(``),x(`Running embeddings...`);let t=await Ml(r,{input:e,target:a});f(e),u(t),g([]),y(`No clustering run yet.`),x(`Embeddings ready`)}function E(e){let t=Number(p);return w.length?!Number.isInteger(t)||t<0||t>=w.length?(n(`Anchor index out of range.`),[]):(n(``),w.map((e,n)=>({index:n,id:Fl(S[n],n),score:Rl(w[t],e)})).filter(n=>e||n.index!==t).sort((e,t)=>t.score-e.score).slice(0,e?w.length:10).map((e,t)=>({rank:t+1,...e}))):(n(`Run embeddings first.`),[])}function D(){g(E(!0))}function O(){g(E(!1))}function k(){if(!w.length){n(`Run embeddings first.`);return}n(``),y(JSON.stringify(q(w),null,2))}function A(){if(!l){n(`Run embeddings first.`);return}Bc(`embeddings.json`,JSON.stringify(l,null,2),`application/json`)}function ee(){if(!l){n(`Run embeddings first.`);return}let e=[`index,input,id,object,model,dimensions,prompt_tokens,total_tokens,vector_preview`],t=l.usage||{};S.forEach((n,r)=>{let i=Pl(n);e.push([r,zl(d[r]||``),zl(n.id??r),zl(n.object??``),zl(l.model??n.model??``),i.length,t.prompt_tokens??``,t.total_tokens??``,zl(i.slice(0,8).join(` `))].join(`,`))}),Bc(`embeddings.csv`,e.join(`
`),`text/csv`)}return(0,R.jsxs)(`div`,{className:`embeddings-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Vectors`}),(0,R.jsx)(`h2`,{children:`Embeddings Workbench`})]}),(0,R.jsx)(`span`,{className:`muted`,children:`Batch /v1/embeddings`})]}),(0,R.jsx)(pe,{message:t}),(0,R.jsxs)(`div`,{className:`split-page-layout`,children:[(0,R.jsxs)(V,{title:`Batch Input`,eyebrow:`Line items`,className:`side-panel`,children:[(0,R.jsxs)(`div`,{className:`side-form`,children:[(0,R.jsx)(B,{label:`Model`,children:(0,R.jsx)(`select`,{value:r,onChange:e=>i(e.target.value),children:e.map(e=>(0,R.jsx)(`option`,{value:W(e),children:W(e)},W(e)))})}),(0,R.jsx)(B,{label:`Route`,children:(0,R.jsxs)(`select`,{value:a,onChange:e=>o(e.target.value),children:[(0,R.jsx)(`option`,{value:`auto`,children:`auto`}),(0,R.jsx)(`option`,{value:`local`,children:`local`}),(0,R.jsx)(`option`,{value:`node:mac`,children:`node:mac`})]})}),(0,R.jsx)(B,{label:`Inputs`,children:(0,R.jsx)(`textarea`,{value:s,onChange:e=>c(e.target.value),rows:10,placeholder:`One input per line`})})]}),(0,R.jsxs)(`div`,{className:`stacked-actions`,children:[(0,R.jsx)(`button`,{className:`primary`,type:`button`,onClick:()=>void T(),children:`Run`}),(0,R.jsx)(`button`,{className:`primary`,type:`button`,onClick:A,children:`Export JSON`}),(0,R.jsx)(`button`,{className:`primary`,type:`button`,onClick:ee,children:`Export CSV`})]}),(0,R.jsx)(`p`,{className:`muted`,children:b})]}),(0,R.jsx)(V,{title:`Results`,eyebrow:`Vectors`,children:(0,R.jsx)(fe,{rows:C,emptyMessage:`No embeddings run yet.`,getRowKey:e=>Fl(e.row,e.index),columns:[{key:`index`,header:`#`,render:e=>String(e.row.index??e.index)},{key:`input`,header:`Input`,render:e=>e.input},{key:`id`,header:`ID`,render:e=>Fl(e.row,e.index)},{key:`object`,header:`Object`,render:e=>String(e.row.object??`-`)},{key:`model`,header:`Model`,render:e=>String(l?.model??e.row.model??`-`)},{key:`dimensions`,header:`Dimensions`,render:e=>String(Pl(e.row).length)},{key:`usage`,header:`Usage`,render:()=>Il(l)},{key:`preview`,header:`Vector preview`,render:e=>(0,R.jsx)(`span`,{className:`path`,children:Ll(Pl(e.row))})}]})}),(0,R.jsxs)(V,{title:`Similarity`,eyebrow:`Vector analysis`,className:`span-all`,children:[(0,R.jsxs)(`div`,{className:`chat-controls compact-controls`,children:[(0,R.jsx)(B,{label:`Anchor index`,children:(0,R.jsx)(`input`,{type:`number`,min:0,step:1,value:p,onChange:e=>m(Number(e.target.value))})}),(0,R.jsx)(`button`,{type:`button`,className:`primary`,onClick:D,children:`Compute Similarity`}),(0,R.jsx)(`button`,{type:`button`,className:`primary`,onClick:O,children:`Nearest Neighbors`}),(0,R.jsx)(`button`,{type:`button`,className:`primary`,onClick:k,children:`Quick Clusters`})]}),(0,R.jsx)(fe,{rows:h,emptyMessage:`Run embeddings first.`,getRowKey:e=>`${e.rank}-${e.index}`,columns:[{key:`rank`,header:`Rank`,render:e=>String(e.rank)},{key:`index`,header:`Index`,render:e=>String(e.index)},{key:`id`,header:`ID`,render:e=>e.id},{key:`score`,header:`Score`,render:e=>e.score.toFixed(6)}]}),(0,R.jsx)(`pre`,{className:`detail-json compact-json`,children:_})]})]})]})}function Bl(){return j(`/runtime/overview`)}function Vl(e){return M(`/runtime/route-preview`,e)}function Hl(e){return e?`Yes`:`No`}function Ul(e){let t=Object.entries(e||{});return t.length?t.map(([e,t])=>`${e}: ${t}`).join(`, `):`None`}function Wl(e){let t=Object.entries(e||{});return t.length?t.map(([e,t])=>`${e}=${String(t)}`).join(`, `):`None`}function Gl(e){let t=[e?.chat?`chat`:``,e?.embeddings?`embeddings`:``,e?.model_transfer?`model transfer`:``].filter(Boolean);return t.length?t.join(`, `):`None`}function Kl(e){return e?.running?`Running`:e?.enabled?`Configured, idle`:e?.configured_enabled?`Misconfigured`:`Disabled`}function ql(){let e=wn(),{data:t,error:n,setError:r,refresh:i}=ua(()=>Bl(),null),[a,o]=(0,v.useState)(`Summarize a long document`),[s,c]=(0,v.useState)(`general`),[l,u]=(0,v.useState)(``),[d,f]=(0,v.useState)(!1),[p,m]=(0,v.useState)(null),[h,g]=(0,v.useState)(``),[_,y]=(0,v.useState)(!1),[b,x]=(0,v.useState)(``);async function S(){g(``),y(!0);try{m(await Vl({task:a,request_type:s||`general`,target:`auto`,requirements:{min_context:l?Number(l):null,needs_json:d,needs_tools:!1}}))}catch(e){g(e instanceof Error?e.message:`Failed to preview route`)}finally{y(!1)}}async function C(){let e=p?.selected;if(!e?.node||!e.model)return;let t=`${e.node}/${e.model}`;g(``),x(t);try{await gi(e.node,e.model),await S(),await i()}catch(e){g(e instanceof Error?e.message:`Failed to start route model`)}finally{x(``)}}let w=t?.agent_tools?.tools||[],T=t?.nodes?.items||[],E=t?.node_runtimes?.items||[],D=t?.running_models?.items||[],O=t?.worker,k=p?.selected?.node&&p.selected.model?`${p.selected.node}/${p.selected.model}`:``,A=!!(p?.selected?.node&&p.selected.model&&p.selected.startup_needed&&p.selected.startup_decision===`start_now`),ee=t?.mode===`controller`?`This shows tools configured on the controller process. Agent-hosted tools are listed in Node Runtime Capabilities.`:`This shows tools configured on this agent process.`;return(0,R.jsxs)(`div`,{className:`runtime-overview-page`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Runtime`}),(0,R.jsx)(`h2`,{children:`Runtime Overview`})]}),(0,R.jsx)(`span`,{className:`muted`,children:`Read-only status for tools, memory, jobs, threads, and node capabilities`})]}),(0,R.jsx)(pe,{message:n}),(0,R.jsxs)(`div`,{className:`runtime-grid`,children:[(0,R.jsxs)(V,{eyebrow:`Runtime Router`,title:`Route Preview`,children:[(0,R.jsx)(`p`,{className:`muted runtime-note`,children:`Preview model selection without sending a chat request.`}),(0,R.jsxs)(`div`,{className:`route-preview-form`,children:[(0,R.jsx)(B,{label:`Task`,children:(0,R.jsx)(`input`,{type:`text`,value:a,onChange:e=>o(e.target.value)})}),(0,R.jsx)(B,{label:`Request type`,children:(0,R.jsxs)(`select`,{value:s,onChange:e=>c(e.target.value),children:[(0,R.jsx)(`option`,{value:`general`,children:`general`}),(0,R.jsx)(`option`,{value:`coding`,children:`coding`}),(0,R.jsx)(`option`,{value:`summarization`,children:`summarization`}),(0,R.jsx)(`option`,{value:`structured`,children:`structured`}),(0,R.jsx)(`option`,{value:`planning`,children:`planning`})]})}),(0,R.jsx)(B,{label:`Min context`,children:(0,R.jsx)(`input`,{inputMode:`numeric`,value:l,onChange:e=>u(e.target.value),placeholder:`8192`})}),(0,R.jsxs)(`label`,{className:`route-preview-check`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:d,onChange:e=>f(e.target.checked)}),(0,R.jsx)(`span`,{children:`Needs JSON schema`})]})]}),(0,R.jsx)(z,{variant:`primary`,onClick:S,disabled:_,children:_?`Previewing...`:`Preview Route`}),(0,R.jsx)(pe,{message:h}),p?(0,R.jsxs)(`div`,{className:`route-preview-result`,children:[(0,R.jsxs)(`div`,{className:`runtime-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Selected`}),(0,R.jsx)(`strong`,{children:p.selected?`${p.selected.node} / ${p.selected.model}`:`No match`})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Reason`}),(0,R.jsx)(`strong`,{children:p.selected?.reason||`-`})]})]}),(0,R.jsx)(`p`,{className:`muted runtime-note`,children:p.explanation}),p.selected?.model?(0,R.jsx)(z,{type:`button`,onClick:()=>e(`/ui/benchmarks?${Qa(p.selected?.model||``,p.selected?.node?`node:${p.selected.node}`:`auto`,p.selected?.node||``,`runtime-preview`)}`),"aria-label":`Benchmark ${p.selected.model}${p.selected.node?` on ${p.selected.node}`:``}`,children:`Benchmark`}):null,A?(0,R.jsxs)(`div`,{className:`route-preview-start`,children:[(0,R.jsx)(`span`,{children:`Model is available but stopped.`}),(0,R.jsx)(z,{variant:`success`,onClick:()=>void C(),disabled:b===k,"aria-label":`Start ${p.selected?.model} on ${p.selected?.node}`,children:b===k?`Starting...`:`Start Model`})]}):p.selected?.startup_needed&&p.selected.startup_decision===`defer`?(0,R.jsx)(`p`,{className:`muted runtime-note`,children:`Model is available but startup is deferred by node capacity.`}):null,(0,R.jsx)(fe,{rows:p.candidates||[],emptyMessage:`No route candidates.`,getRowKey:(e,t)=>`${e.node||`node`}-${e.model||t}`,columns:[{key:`route`,header:`Route`,render:e=>`${e.node||`-`} / ${e.model||`-`}`},{key:`eligible`,header:`Eligible`,render:e=>Hl(e.eligible)},{key:`score`,header:`Score`,render:e=>String(e.score??0)},{key:`source`,header:`Source`,render:e=>String(e.source||`-`)},{key:`running`,header:`Running`,render:e=>Hl(e.running)},{key:`startup`,header:`Startup`,render:e=>e.startup_needed?String(e.startup_decision||`-`):`-`},{key:`strengths`,header:`Strengths`,render:e=>e.strengths?.join(`, `)||`-`},{key:`cost_tier`,header:`Cost`,render:e=>String(e.cost_tier||`-`)},{key:`rejections`,header:`Rejections`,render:e=>e.rejections?.join(`, `)||`-`}]})]}):null]}),(0,R.jsxs)(V,{eyebrow:`Local Runtime`,title:`Tool Runtime`,children:[(0,R.jsx)(`p`,{className:`muted runtime-note`,children:ee}),(0,R.jsxs)(`div`,{className:`runtime-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Enabled`}),(0,R.jsx)(`strong`,{children:Hl(t?.agent_tools?.enabled)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Tool count`}),(0,R.jsx)(`strong`,{children:t?.agent_tools?.tool_count??0})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Max iterations`}),(0,R.jsx)(`strong`,{children:t?.agent_tools?.max_iterations??`-`})]})]}),(0,R.jsx)(fe,{rows:w,emptyMessage:`No agent tools configured.`,getRowKey:(e,t)=>String(e.name||t),columns:[{key:`name`,header:`Name`,render:e=>String(e.name||`-`)},{key:`type`,header:`Type`,render:e=>String(e.type||`-`)},{key:`description`,header:`Description`,render:e=>String(e.description||`-`)}]})]}),(0,R.jsxs)(V,{eyebrow:`Agent Runtime`,title:`Worker`,children:[(0,R.jsxs)(`div`,{className:`runtime-summary worker-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Status`}),(0,R.jsx)(`strong`,{children:Kl(O)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Node`}),(0,R.jsx)(`strong`,{children:O?.node_name||`-`})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Max jobs`}),(0,R.jsx)(`strong`,{children:O?.max_jobs??`-`})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Poll`}),(0,R.jsxs)(`strong`,{children:[O?.poll_interval_seconds??`-`,`s`]})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Executors`}),(0,R.jsx)(`strong`,{children:Gl(O?.executors)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Controller`}),(0,R.jsx)(`strong`,{children:O?.controller_url||`-`})]})]}),(0,R.jsxs)(`div`,{className:`runtime-debug-lines`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Labels`}),(0,R.jsx)(`code`,{children:Wl(O?.labels)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Capacity`}),(0,R.jsx)(`code`,{children:Wl(O?.capacity)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Claim`}),(0,R.jsx)(`code`,{children:O?.claim_url||`-`})]})]})]}),t?.node_runtimes?.available?(0,R.jsxs)(V,{eyebrow:`Controller Runtime`,title:`Node Runtime Capabilities`,children:[(0,R.jsx)(`p`,{className:`muted runtime-note`,children:`Runtime features reported by each connected agent.`}),(0,R.jsx)(fe,{rows:E,emptyMessage:`No node runtime reports available.`,getRowKey:(e,t)=>String(e.name||t),columns:[{key:`name`,header:`Node`,render:e=>String(e.name||`-`)},{key:`reachable`,header:`Reachable`,render:e=>Hl(e.reachable)},{key:`tools_enabled`,header:`Tools`,render:e=>e.tools_enabled?`Enabled (${e.tool_count??0})`:`Disabled`},{key:`memory_configured`,header:`Memory config`,render:e=>Hl(e.memory_configured)},{key:`memory_available`,header:`Memory available`,render:e=>Hl(e.memory_available)},{key:`worker`,header:`Worker`,render:e=>Kl({enabled:e.worker_enabled,running:e.worker_running})},{key:`worker_jobs`,header:`Jobs`,render:e=>String(e.worker_max_jobs??`-`)},{key:`worker_labels`,header:`Labels`,render:e=>Wl(e.worker_labels)},{key:`worker_executors`,header:`Executors`,render:e=>Gl(e.worker_executors)}]})]}):null,(0,R.jsxs)(V,{eyebrow:`Memory`,title:`Semantic Memory`,children:[(0,R.jsxs)(`div`,{className:`runtime-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Configured`}),(0,R.jsx)(`strong`,{children:Hl(t?.memory?.configured)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Available`}),(0,R.jsx)(`strong`,{children:Hl(t?.memory?.available)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Auto inject`}),(0,R.jsx)(`strong`,{children:Hl(t?.memory?.auto_inject)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Top K`}),(0,R.jsx)(`strong`,{children:t?.memory?.top_k??`-`})]})]}),(0,R.jsx)(`p`,{className:`muted runtime-path`,children:t?.memory?.path||`No memory path configured.`})]}),(0,R.jsx)(V,{eyebrow:`Controller Runtime`,title:`Jobs And Threads`,children:(0,R.jsxs)(`div`,{className:`runtime-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Jobs available`}),(0,R.jsx)(`strong`,{children:Hl(t?.jobs?.available)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Job counts`}),(0,R.jsx)(`strong`,{children:Ul(t?.jobs?.counts)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Threads available`}),(0,R.jsx)(`strong`,{children:Hl(t?.threads?.available)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Thread count`}),(0,R.jsx)(`strong`,{children:t?.threads?.count??0})]}),t?.downloads?.available&&(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Active downloads`}),(0,R.jsx)(`strong`,{children:t.downloads.active_count??0})]})]})}),(0,R.jsxs)(V,{eyebrow:`Controller Runtime`,title:`Node Capabilities`,children:[(0,R.jsxs)(`div`,{className:`runtime-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Available`}),(0,R.jsx)(`strong`,{children:Hl(t?.nodes?.available)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Node count`}),(0,R.jsx)(`strong`,{children:t?.nodes?.count??0})]})]}),(0,R.jsx)(fe,{rows:T,emptyMessage:`No controller nodes available.`,getRowKey:(e,t)=>String(e.name||t),columns:[{key:`name`,header:`Node`,render:e=>String(e.name||`-`)},{key:`registration`,header:`Type`,render:e=>String(e.registration||`-`)},{key:`default_model`,header:`Default model`,render:e=>String(e.default_model||`-`)},{key:`request_types`,header:`Request types`,render:e=>Array.isArray(e.request_types)&&e.request_types.join(`, `)||`-`},{key:`fresh`,header:`Heartbeat`,render:e=>{if(e.heartbeat_fresh===!1){let t=e.heartbeat_age_seconds;return typeof t==`number`?`Stale (${t}s ago)`:`Stale`}let t=e.heartbeat_age_seconds;return typeof t==`number`?`Fresh (${t}s ago)`:`Fresh/Static`}}]})]}),t?.running_models?.available&&(0,R.jsxs)(V,{eyebrow:`Agent Runtime`,title:`Running Models`,children:[(0,R.jsx)(`div`,{className:`runtime-summary`,children:(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Running`}),(0,R.jsx)(`strong`,{children:t.running_models.count??0})]})}),(0,R.jsx)(fe,{rows:D,emptyMessage:`No models running.`,getRowKey:(e,t)=>String(e.name||t),columns:[{key:`name`,header:`Model`,render:e=>String(e.name||`-`)},{key:`port`,header:`Port`,render:e=>String(e.port??`-`)},{key:`profile_label`,header:`Profile`,render:e=>String(e.profile_label||`-`)},{key:`profile_kind`,header:`Kind`,render:e=>String(e.profile_kind||`-`)},{key:`resource_tier`,header:`Tier`,render:e=>String(e.resource_tier||`-`)}]})]})]})]})}function Jl(e,t=``){let n=`${t}${e}`.split(`

`),r=n.pop()||``;return{events:n.flatMap(e=>{let t=e.split(`
`).filter(e=>e.startsWith(`data:`)).map(e=>e.slice(5).trim()).join(`
`);if(!t)return[];try{return[JSON.parse(t)]}catch{return[]}}),buffer:r}}function Yl(e){return Jl(e.endsWith(`

`)?e:`${e}\n\n`).events}function Xl(){return j(`/runtime/tool-loop-evals/latest`)}function Zl(){return j(`/runtime/tool-loop-evals/presets`)}function Ql(e=50){return j(`/runtime/tool-loop-evals/runs?limit=${encodeURIComponent(String(e))}`)}function $l(e){return j(`/runtime/tool-loop-evals/runs/${encodeURIComponent(e)}`)}async function eu(e,t,n){let r=await ne(e,{method:`POST`,body:t}),i=new TextDecoder,a=``,o=null;for(;;){let{done:e,value:t}=await r.read(),s=Jl(i.decode(t||new Uint8Array,{stream:!e}),a);a=s.buffer;for(let e of s.events){n(e);let t=e.payload?.suite;(e.event_type===`run_completed`||e.event_type===`run_failed`)&&t&&typeof t==`object`&&(o=t)}if(e)break}for(let e of Yl(a)){n(e);let t=e.payload?.suite;(e.event_type===`run_completed`||e.event_type===`run_failed`)&&t&&typeof t==`object`&&(o=t)}if(!o)throw Error(`Tool-loop eval stream ended without a final suite.`);return o}function tu(e,t){return eu(`/runtime/tool-loop-evals/run/stream`,e,t)}function nu(e,t){return eu(`/runtime/tool-loop-evals/node-run/stream`,e,t)}var ru=[{id:`missing_tools`,label:`Missing tools`,description:`Required tools were not called.`},{id:`unexpected_tools`,label:`Unexpected tools`,description:`The model called tools outside the expected path.`},{id:`repeated_tools`,label:`Repeated tools`,description:`The model repeated tool calls beyond the preset allowance.`},{id:`tool_errors`,label:`Tool errors`,description:`Tool calls returned errors outside expected recovery paths.`},{id:`missing_final_facts`,label:`Missing final facts`,description:`The final answer omitted required facts or sections.`},{id:`max_iterations`,label:`Max iterations`,description:`The loop ended before a final assistant response.`},{id:`artifact_failures`,label:`Artifact failures`,description:`Expected generated artifacts or artifact content were missing.`},{id:`argument_mismatch`,label:`Argument mismatch`,description:`Required tool arguments were missing or incorrect.`}];function iu(e){let t=e?.cases||[],n=t.filter(e=>e.status===`failed`),r=new Map;for(let e of n){let t=e.case_id||`unknown-case`;for(let n of au(e)){let e=r.get(n)||new Set;e.add(t),r.set(n,e)}}let i=ru.flatMap(e=>{let t=Array.from(r.get(e.id)||[]);return t.length?[{...e,count:t.length,caseIds:t}]:[]});return{totalCaseCount:t.length||Number(e?.case_count||0),failedCaseCount:n.length||Number(e?.failed_count||0),buckets:i,likelyCauses:cu(i)}}function au(e){let t=[],n=e.checks||{};return(e.missing_expected_tools?.length||n.expected_tool_sequence===!1)&&t.push(`missing_tools`),e.unexpected_tools?.length&&t.push(`unexpected_tools`),(n.no_repeated_calls===!1||ou(e.observed_tool_sequence||[]))&&t.push(`repeated_tools`),(n.no_tool_errors===!1||e.tool_results?.some(e=>e.ok===!1))&&t.push(`tool_errors`),n.expected_final_substrings===!1&&t.push(`missing_final_facts`),String(e.error||``).includes(`max_iterations`)&&t.push(`max_iterations`),su(e)&&t.push(`artifact_failures`),n.expected_tool_arguments===!1&&t.push(`argument_mismatch`),t}function ou(e){let t=new Set;for(let n of e){if(t.has(n))return!0;t.add(n)}return!1}function su(e){let t=e.checks||{};return t.expected_artifacts===!1||t.expected_artifact_substrings===!1?!0:Object.keys(e.diagnostics||{}).some(e=>e.toLowerCase().includes(`artifact`))}function cu(e){let t=new Set(e.map(e=>e.id)),n=[];return(t.has(`repeated_tools`)||t.has(`max_iterations`))&&n.push(`Loop control: repeated calls or max-iteration exits.`),(t.has(`missing_tools`)||t.has(`unexpected_tools`))&&n.push(`Tool selection: missing required tools or unrelated tool calls.`),t.has(`argument_mismatch`)&&n.push(`Argument handling: required tool arguments were not preserved.`),(t.has(`missing_final_facts`)||t.has(`artifact_failures`))&&n.push(`Synthesis: gathered evidence was not fully reflected in the final output.`),t.has(`tool_errors`)&&n.push(`Runtime/tooling: tool calls failed or recovery behavior was incomplete.`),n}function lu(e){let t=e.map(uu),n=t.toSorted((e,t)=>t.averageScore-e.averageScore)[0]||null,r=t.map(e=>e.averageScore).toSorted((e,t)=>t-e);return{runs:t,caseRows:du(e,t.map(e=>e.runId)),bestRunId:n?.runId||null,scoreDelta:_u((r[0]||0)-(r[1]||0)),failedCheckDeltas:Object.fromEntries(e.map(e=>[gu(e),pu(e)])),failureBucketDeltas:Object.fromEntries(e.map(e=>[gu(e),iu(e).buckets]))}}function uu(e){let t=gu(e),n=Number(e.case_count??e.cases?.length??0),r=Number(e.passed_count??e.cases?.filter(e=>e.status===`passed`).length??0),i=Number(e.failed_count??e.cases?.filter(e=>e.status===`failed`).length??0),a=String(e.target_node||e.target_selector||`-`),o=String(e.model||`-`);return{runId:t,label:`${o} · ${a}`,model:o,target:a,status:String(e.status||`-`),averageScore:Number(e.average_score??hu(e.cases||[])),passRate:n>0?_u(r/n):0,caseCount:n,passedCount:r,failedCaseCount:i}}function du(e,t){return Array.from(new Set(e.flatMap(e=>(e.cases||[]).map(e=>String(e.case_id||`unknown-case`))))).sort().map(n=>({caseId:n,cells:Object.fromEntries(e.map((e,r)=>{let i=(e.cases||[]).find(e=>e.case_id===n);return[t[r],i?fu(i):{status:`missing`,score:0,failedChecks:[`missing_case`]}]}))}))}function fu(e){return{status:String(e.status||`-`),score:Number(e.score??0),failedChecks:mu(e)}}function pu(e){return Array.from(new Set((e.cases||[]).flatMap(e=>mu(e)))).sort()}function mu(e){return Object.entries(e.checks||{}).filter(([,e])=>e===!1).map(([e])=>e).sort()}function hu(e){return e.length?_u(e.reduce((e,t)=>e+Number(t.score||0),0)/e.length):0}function gu(e){return String(e.id||`${e.model||`run`}-${e.generated_at||``}`||`run`)}function _u(e){return Math.round(e*1e4)/1e4}function vu(e){return`${Math.round((e??0)*100)}%`}function yu(e){return e===`passed`?`success`:e===`failed`?`danger`:e===`partial`?`warning`:`muted`}function bu(e){return e?.length?e.join(` -> `):`-`}function xu(e){if(!e)return`-`;let t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString()}function Su(e){return Object.entries(e?.checks||{}).map(([e,t])=>[e,!!t])}function Cu(e){return JSON.stringify(e??{},null,2)}function wu(e){return!!(e.missing_expected_tools?.length||e.unexpected_tools?.length||Object.keys(e.diagnostics||{}).length)}function Tu(e){let t=e.expected_tool_sequence||[],n=new Map,r=e.tool_results||[];return r.length?r.map((r,i)=>{let a=String(r.tool_name||r.function?.name||e.observed_tool_sequence?.[i]||`-`),o=(n.get(a)||0)+1;return n.set(a,o),{index:i,toolName:a,ok:r.ok!==!1,expected:t.includes(a),repeated:o>1,call:{tool_call_id:r.tool_call_id||`step-${i+1}`,type:`function`,function:r.function||{name:a,arguments:r.raw_arguments||Cu(r.arguments||{})}},toolResult:r.result||{ok:r.ok!==!1,error:r.error||``,arguments:r.arguments||{}},error:String(r.error||``)}}):(e.observed_tool_sequence||[]).map((e,r)=>{let i=(n.get(e)||0)+1;return n.set(e,i),{index:r,toolName:e,ok:!0,expected:t.includes(e),repeated:i>1,call:{tool_call_id:`step-${r+1}`,type:`function`,function:{name:e,arguments:`{}`}},toolResult:{ok:!0},error:``}})}function Eu(e,t){if(e.trace_events?.length)return e.trace_events;let n=e.case_id||``;return t.filter(e=>!n||e.case_id===n)}function Du(e){return e?.cases?.[0]||null}function Ou(e){let t=(e||[]).filter(e=>e.label&&e.presets?.length);if(!t.length)return[{id:`all`,label:`Presets`,presets:[{id:`all`,label:`All presets`}]}];let[n,...r]=t;return[{...n,presets:[{id:`all`,label:`All presets`},...n.presets]},...r]}function ku(e){if(!e)return``;let t=e;return String(t.target_node||t.target_selector||``)}function Au(e){return String(e.name||e.id||e.model||``)}function ju(e){return Array.isArray(e)?e:e?.nodes||[]}function Mu(e){if(Array.isArray(e))return e;let t=e?.models;return Array.isArray(t)?t:[]}function Nu(e){return ju(e).flatMap(e=>{let t=String(e.name||``),n=Mu(e.models);return!t||e.reachable===!1||!n.length?[]:n.map(e=>({...e,node:t}))}).filter(e=>Au(e))}function Pu(){let e=Yi(),t=e===`agent`,n=e===`controller`,{data:r,loading:i,error:a,refresh:o}=ua(()=>Xl(),null),{data:s,loading:c,error:l,refresh:u}=ua(()=>Ql(50),{runs:[]}),{data:d,error:f}=ua(()=>Zl(),{groups:[]}),{data:p,loading:m,error:h}=ua(async()=>t?Mu(await _a()):n?Nu(await mi()):[],[],[n,t]),g=r?.suites||[],_=s.runs||[],y=(0,v.useMemo)(()=>Ou(d.groups),[d.groups]),[b,x]=(0,v.useState)(``),[S,C]=(0,v.useState)(``),[w,T]=(0,v.useState)(null),[E,D]=(0,v.useState)(!1),[O,k]=(0,v.useState)(``),[A,ee]=(0,v.useState)(``),[j,M]=(0,v.useState)(``),[te,N]=(0,v.useState)(`all`),[P,F]=(0,v.useState)(``),[ne,re]=(0,v.useState)([]),[ie,I]=(0,v.useState)([]),[ae,L]=(0,v.useState)(!1),[oe,se]=(0,v.useState)(``),[ce,le]=(0,v.useState)([]),[ue,de]=(0,v.useState)(0),me=(0,v.useMemo)(()=>n?Array.from(new Set(p.map(e=>String(e.node||e.node_name||``)).filter(Boolean))):[],[n,p]),he=(0,v.useMemo)(()=>t?p:p.filter(e=>!A||e.node===A||e.node_name===A),[t,p,A]);(0,v.useEffect)(()=>{!A&&me.length&&ee(me[0]),t&&A&&ee(``)},[t,me,A]),(0,v.useEffect)(()=>{M(he.length?Au(he[0]):``)},[he]);let ge=(0,v.useMemo)(()=>w||(g.length?g.find(e=>e.model===b)||g[0]:null),[b,w,g]),_e=(0,v.useMemo)(()=>ge?ge.cases?.find(e=>e.case_id===S)||Du(ge):null,[ge,S]),U=(0,v.useMemo)(()=>iu(ge),[ge]),ve=(0,v.useMemo)(()=>ie.length>=2?lu(ie):null,[ie]);async function ye(){k(``),await Promise.all([o(),u()])}async function be(e){if(e.id){D(!0),k(``);try{let t=await $l(e.id);T(t),x(String(t.model||e.model||``)),C(``)}catch(e){k(e instanceof Error?e.message:`Request failed`)}finally{D(!1)}}}function xe(e,t){let n=String(e.id||``);n&&(I([]),se(``),re(e=>t?e.includes(n)?e:[...e,n].slice(-3):e.filter(e=>e!==n)))}async function Se(){if(ne.length<2){se(`Select at least two runs to compare.`);return}L(!0),se(``);try{I(await Promise.all(ne.map(e=>$l(e))))}catch(e){se(e instanceof Error?e.message:`Request failed`)}finally{L(!1)}}async function Ce(e){e.preventDefault();let n=A.trim(),r=j.trim();if(!r){k(`Model is required to run tool-loop evals.`);return}if(!t&&!n){k(`Node and model are required to run tool-loop evals.`);return}D(!0),k(``),F(``);try{let e={model:r,...te===`all`?{}:{case_ids:[te]}};le([]),de(e=>e+1);let i=t?await tu(e,e=>le(t=>[...t,e])):await nu({node:n,...e},e=>le(t=>[...t,e]));T({id:i.persisted_run_id,generated_at:new Date().toISOString(),model:i.model,target_selector:t?`local`:`node:${n}`,target_node:t?null:n,status:i.status,average_score:i.average_score,case_count:i.case_count,passed_count:i.passed_count,failed_count:i.failed_count,cases:i.cases}),x(String(i.model||r)),C(``),F(`Tool-loop eval run completed.`),await Promise.all([u(),o()])}catch(e){k(e instanceof Error?e.message:`Request failed`)}finally{D(!1)}}return(0,R.jsxs)(`div`,{className:`tool-loop-evals-page`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Runtime`}),(0,R.jsx)(`h2`,{children:`Tool Loop Evals`})]}),(0,R.jsx)(z,{type:`button`,onClick:()=>void ye(),disabled:i||c||E||ae,children:i||c||E||ae?`Refreshing...`:`Refresh`})]}),(0,R.jsx)(pe,{message:a||l||f||h||O||oe||r?.error||``}),(0,R.jsx)(V,{title:`Run Tool-Loop Eval`,eyebrow:t?`Local instance run`:n?`Controller-triggered node run`:`Runtime mode loading`,children:(0,R.jsxs)(`form`,{className:`tool-loop-run-form stacked-controls`,onSubmit:e=>void Ce(e),children:[n?(0,R.jsx)(B,{label:`Node`,children:(0,R.jsx)(`select`,{value:A,onChange:e=>ee(e.target.value),disabled:m||E,children:me.length?me.map(e=>(0,R.jsx)(`option`,{value:e,children:e},e)):(0,R.jsx)(`option`,{value:``,children:`No reachable nodes`})})}):null,(0,R.jsxs)(B,{label:`Model`,children:[(0,R.jsx)(`input`,{list:`tool-loop-model-options`,value:j,onChange:e=>M(e.target.value),placeholder:`gpt-oss-20b`,disabled:E}),(0,R.jsx)(`datalist`,{id:`tool-loop-model-options`,children:he.map(e=>{let t=Au(e);return(0,R.jsx)(`option`,{value:t},`${e.node||e.node_name||`local`}-${t}`)})})]}),(0,R.jsx)(B,{label:`Preset`,children:(0,R.jsx)(`select`,{value:te,onChange:e=>N(e.target.value),disabled:E,children:y.map(e=>(0,R.jsx)(`optgroup`,{label:e.label,children:e.presets.map(e=>(0,R.jsx)(`option`,{value:e.id,children:e.label},e.id))},e.id||e.label))})}),(0,R.jsxs)(`div`,{className:`tool-loop-run-actions`,children:[(0,R.jsx)(z,{type:`submit`,variant:`primary`,disabled:E||!j||!t&&!n||n&&!A,children:E?`Running...`:`Run Eval`}),P?(0,R.jsx)(`span`,{className:`muted`,children:P}):null]})]})}),(0,R.jsxs)(V,{title:`Run History`,eyebrow:`Persisted benchmark DB results`,children:[(0,R.jsx)(fe,{rows:_,emptyMessage:`No persisted tool-loop eval runs yet.`,getRowKey:(e,t)=>String(e.id||t),columns:[{key:`compare`,header:`Compare`,render:e=>{let t=String(e.id||``);return(0,R.jsx)(`input`,{type:`checkbox`,"aria-label":`Compare ${e.model||t||`run`}`,checked:!!(t&&ne.includes(t)),disabled:!t||ae,onChange:t=>xe(e,t.target.checked)})}},{key:`generated`,header:`Generated`,render:e=>xu(e.generated_at)},{key:`model`,header:`Model`,render:e=>String(e.model||`-`)},{key:`target`,header:`Target`,render:e=>String(e.target_node||e.target_selector||`-`)},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:yu(e.status),children:e.status||`-`})},{key:`score`,header:`Score`,render:e=>vu(e.average_score)},{key:`passed`,header:`Passed`,render:e=>`${e.passed_count??0} / ${e.case_count??0}`},{key:`view`,header:``,render:e=>(0,R.jsx)(z,{type:`button`,"aria-label":`View run ${e.model||e.id||`detail`}`,disabled:E,onClick:()=>void be(e),children:`View`})}]}),(0,R.jsxs)(`div`,{className:`tool-loop-compare-actions`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>void Se(),disabled:ae||ne.length<2,children:ae?`Comparing...`:`Compare Selected`}),(0,R.jsxs)(`span`,{className:`muted`,children:[ne.length,` selected`]})]})]}),ve?(0,R.jsx)(Fu,{comparison:ve}):null,!i&&!r?.available?(0,R.jsxs)(V,{title:`No tool-loop eval results yet.`,eyebrow:`Latest results`,children:[(0,R.jsx)(`p`,{className:`muted`,children:`Run a tool-loop eval from this page, then refresh to inspect the latest summary.`}),(0,R.jsx)(`p`,{className:`muted tool-loop-path`,children:r?.path||`logs/tool_loop_eval_latest.json`})]}):null,r?.available?(0,R.jsx)(R.Fragment,{children:(0,R.jsxs)(V,{title:`Latest Summary`,eyebrow:`Tool-call loop quality`,children:[(0,R.jsxs)(`div`,{className:`tool-loop-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Generated`}),(0,R.jsx)(`strong`,{children:xu(r.generated_at)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Models`}),(0,R.jsx)(`strong`,{children:r.models?.length??0})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Suites`}),(0,R.jsx)(`strong`,{children:r.suite_count??g.length})]})]}),(0,R.jsx)(`p`,{className:`muted tool-loop-path`,children:r.path}),(0,R.jsx)(fe,{rows:g,emptyMessage:`No suites in latest result.`,getRowKey:(e,t)=>String(e.model||t),columns:[{key:`model`,header:`Model`,render:e=>String(e.model||`-`)},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:yu(e.status),children:e.status||`-`})},{key:`score`,header:`Score`,render:e=>vu(e.average_score)},{key:`passed`,header:`Passed`,render:e=>`${e.passed_count??0} / ${e.case_count??0}`},{key:`view`,header:``,render:e=>(0,R.jsx)(z,{type:`button`,onClick:()=>{x(String(e.model||``)),C(``)},children:`View`})}]})]})}):null,ge?(0,R.jsx)(R.Fragment,{children:U.failedCaseCount>0?(0,R.jsx)(Iu,{summary:U}):null}):null,ge?(0,R.jsxs)(`div`,{className:`tool-loop-grid`,children:[(0,R.jsx)(V,{title:ge?.model||`Model`,eyebrow:w?`Persisted run cases${ku(ge)?` · ${ku(ge)}`:``}`:`Cases`,children:(0,R.jsx)(`div`,{className:`tool-loop-case-list`,children:(ge?.cases||[]).map(e=>(0,R.jsxs)(`button`,{type:`button`,className:`tool-loop-case-button ${e.case_id===_e?.case_id?`active`:``}`,onClick:()=>C(String(e.case_id||``)),children:[(0,R.jsxs)(`span`,{className:`tool-loop-case-heading`,children:[(0,R.jsx)(`strong`,{children:e.case_id||`-`}),(0,R.jsx)(H,{tone:yu(e.status),children:e.status||`-`})]}),(0,R.jsxs)(`span`,{className:`muted`,children:[vu(e.score),` · `,e.tool_call_count??0,` calls · `,e.iteration_count??0,` turns`]}),(0,R.jsx)(`span`,{className:`tool-loop-sequence`,children:bu(e.observed_tool_sequence)})]},e.case_id))})}),(0,R.jsx)(V,{title:_e?.case_id||`Case Detail`,eyebrow:`Evaluation`,children:_e?(0,R.jsxs)(R.Fragment,{children:[(0,R.jsxs)(`div`,{className:`tool-loop-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Score`}),(0,R.jsx)(`strong`,{children:vu(_e.score)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Tool calls`}),(0,R.jsx)(`strong`,{children:_e.tool_call_count??0})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Iterations`}),(0,R.jsx)(`strong`,{children:_e.iteration_count??0})]})]}),(0,R.jsx)(`p`,{className:`muted`,children:`Observed`}),(0,R.jsx)(`p`,{className:`tool-loop-sequence`,children:bu(_e.observed_tool_sequence)}),(0,R.jsx)(`p`,{className:`muted`,children:`Required tools`}),(0,R.jsx)(`p`,{className:`tool-loop-sequence`,children:bu(_e.expected_tool_sequence)}),(0,R.jsx)(`div`,{className:`tool-loop-checks`,"aria-label":`Case checks`,children:Su(_e).map(([e,t])=>(0,R.jsx)(H,{tone:t?`success`:`danger`,children:e},e))}),wu(_e)?(0,R.jsx)(Lu,{result:_e}):null,(0,R.jsx)(Ru,{result:_e}),(0,R.jsx)(zu,{events:Eu(_e,ce),autoPlayToken:ue}),_e.error?(0,R.jsx)(pe,{message:_e.error}):null,(0,R.jsx)(`p`,{className:`muted`,children:`Final answer`}),(0,R.jsx)(`pre`,{className:`tool-loop-answer`,children:_e.final_answer||`-`})]}):(0,R.jsx)(`p`,{className:`muted`,children:`No case selected.`})})]}):null]})}function Fu({comparison:e}){let t=e.runs.find(t=>t.runId===e.bestRunId);return(0,R.jsxs)(V,{title:`Run Comparison`,eyebrow:`Selected persisted runs`,children:[(0,R.jsxs)(`div`,{className:`tool-loop-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Best run`}),(0,R.jsx)(`strong`,{children:t?.label||`-`})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Score delta`}),(0,R.jsx)(`strong`,{children:vu(e.scoreDelta)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Compared`}),(0,R.jsx)(`strong`,{children:e.runs.length})]})]}),(0,R.jsx)(fe,{rows:e.runs,emptyMessage:`No comparison runs selected.`,getRowKey:e=>e.runId,columns:[{key:`run`,header:`Run`,render:e=>e.label},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:yu(e.status),children:e.status})},{key:`score`,header:`Score`,render:e=>vu(e.averageScore)},{key:`passRate`,header:`Pass rate`,render:e=>vu(e.passRate)},{key:`failed`,header:`Failed`,render:e=>String(e.failedCaseCount)}]}),(0,R.jsxs)(`div`,{className:`tool-loop-comparison-section`,children:[(0,R.jsxs)(`div`,{className:`tool-loop-section-heading`,children:[(0,R.jsx)(`strong`,{children:`Case Comparison`}),(0,R.jsxs)(`span`,{className:`muted`,children:[e.caseRows.length,` case`,e.caseRows.length===1?``:`s`]})]}),(0,R.jsx)(fe,{rows:e.caseRows,emptyMessage:`No cases to compare.`,getRowKey:e=>e.caseId,columns:[{key:`case`,header:`Case`,render:e=>e.caseId},...e.runs.map(e=>({key:e.runId,header:e.model,render:t=>{let n=t.cells[e.runId];return(0,R.jsxs)(`div`,{className:`tool-loop-comparison-cell`,children:[(0,R.jsx)(H,{tone:yu(n?.status),children:n?.status||`-`}),(0,R.jsx)(`span`,{children:vu(n?.score)}),n?.failedChecks.length?(0,R.jsx)(`span`,{className:`muted`,children:n.failedChecks.join(`, `)}):null]})}}))]})]}),(0,R.jsxs)(`div`,{className:`tool-loop-comparison-section`,children:[(0,R.jsxs)(`div`,{className:`tool-loop-section-heading`,children:[(0,R.jsx)(`strong`,{children:`Failure Buckets`}),(0,R.jsx)(`span`,{className:`muted`,children:`By run`})]}),(0,R.jsx)(`div`,{className:`tool-loop-failure-buckets`,children:e.runs.map(t=>{let n=e.failureBucketDeltas[t.runId]||[];return(0,R.jsxs)(`div`,{className:`tool-loop-failure-bucket`,children:[(0,R.jsxs)(`span`,{className:`tool-loop-case-heading`,children:[(0,R.jsx)(`strong`,{children:t.label}),(0,R.jsx)(H,{tone:n.length?`danger`:`success`,children:n.length})]}),n.length?(0,R.jsx)(`span`,{className:`tool-loop-sequence`,children:n.map(e=>e.label).join(`, `)}):(0,R.jsx)(`span`,{className:`muted`,children:`No failure buckets`})]},t.runId)})})]})]})}function Iu({summary:e}){return(0,R.jsxs)(V,{title:`Failure Summary`,eyebrow:`Frontend-derived analysis`,children:[(0,R.jsxs)(`div`,{className:`tool-loop-summary`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Failed cases`}),(0,R.jsxs)(`strong`,{children:[e.failedCaseCount,` failed cases`]})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Total cases`}),(0,R.jsx)(`strong`,{children:e.totalCaseCount})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Failure buckets`}),(0,R.jsx)(`strong`,{children:e.buckets.length})]})]}),(0,R.jsx)(`div`,{className:`tool-loop-failure-buckets`,"aria-label":`Failure buckets`,children:e.buckets.map(e=>(0,R.jsxs)(`div`,{className:`tool-loop-failure-bucket`,children:[(0,R.jsxs)(`span`,{className:`tool-loop-case-heading`,children:[(0,R.jsx)(`strong`,{children:e.label}),(0,R.jsx)(H,{tone:`danger`,children:e.count})]}),(0,R.jsx)(`span`,{className:`muted`,children:e.description}),(0,R.jsx)(`span`,{className:`tool-loop-sequence`,children:e.caseIds.join(`, `)})]},e.id))}),e.likelyCauses.length?(0,R.jsxs)(`div`,{className:`tool-loop-likely-causes`,"aria-label":`Likely causes`,children:[(0,R.jsx)(`p`,{className:`muted`,children:`Likely causes`}),(0,R.jsx)(`ul`,{children:e.likelyCauses.map(e=>(0,R.jsx)(`li`,{children:e},e))})]}):null]})}function Lu({result:e}){return(0,R.jsxs)(`div`,{className:`tool-loop-diagnostics`,"aria-label":`Case diagnostics`,children:[e.missing_expected_tools?.length?(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Missing required tools`}),(0,R.jsx)(`pre`,{className:`tool-loop-json`,children:Cu(e.missing_expected_tools)})]}):null,e.unexpected_tools?.length?(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Extra observed tools`}),(0,R.jsx)(`pre`,{className:`tool-loop-json`,children:Cu(e.unexpected_tools)})]}):null,Object.keys(e.diagnostics||{}).length?(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Artifact diagnostics`}),(0,R.jsx)(`pre`,{className:`tool-loop-json`,children:Cu(e.diagnostics)})]}):null]})}function Ru({result:e}){let t=Tu(e),n=(e.expected_tool_sequence||[]).filter(t=>!(e.observed_tool_sequence||[]).includes(t));return!t.length&&!n.length?null:(0,R.jsxs)(`div`,{className:`tool-loop-timeline`,"aria-label":`Tool call timeline`,children:[(0,R.jsxs)(`div`,{className:`tool-loop-section-heading`,children:[(0,R.jsx)(`strong`,{children:`Tool Call Timeline`}),(0,R.jsxs)(`span`,{className:`muted`,children:[t.length,` call`,t.length===1?``:`s`]})]}),(0,R.jsxs)(`div`,{className:`tool-loop-timeline-list`,children:[t.map(e=>(0,R.jsxs)(`details`,{className:`tool-loop-step ${e.ok?``:`failed`}`,children:[(0,R.jsxs)(`summary`,{children:[(0,R.jsx)(`span`,{className:`tool-loop-step-index`,children:e.index+1}),(0,R.jsx)(`span`,{className:`tool-loop-step-name`,children:e.toolName}),(0,R.jsx)(H,{tone:e.ok?`success`:`danger`,children:e.ok?`ok`:`error`}),e.expected?null:(0,R.jsx)(H,{tone:`warning`,children:`unexpected`}),e.repeated?(0,R.jsx)(H,{tone:`warning`,children:`repeated`}):null,(0,R.jsx)(`button`,{type:`button`,className:`tool-loop-inspect-label`,"aria-label":`Inspect tool call ${e.index+1} ${e.toolName}`,onClick:e=>{e.preventDefault();let t=e.currentTarget.closest(`details`);t&&(t.open=!t.open)},children:`Inspect`})]}),(0,R.jsxs)(`div`,{className:`tool-loop-step-detail`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`p`,{className:`muted`,children:`Function call`}),(0,R.jsx)(`pre`,{className:`tool-loop-json`,children:Cu(e.call)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`p`,{className:`muted`,children:`Tool result`}),(0,R.jsx)(`pre`,{className:`tool-loop-json`,children:Cu(e.toolResult)})]}),e.error?(0,R.jsx)(pe,{message:e.error}):null]})]},`${e.index}-${e.toolName}`)),n.map(e=>(0,R.jsxs)(`div`,{className:`tool-loop-step missing`,children:[(0,R.jsx)(`span`,{className:`tool-loop-step-index`,children:`-`}),(0,R.jsx)(`span`,{className:`tool-loop-step-name`,children:e}),(0,R.jsx)(H,{tone:`danger`,children:`missing`})]},`missing-${e}`))]})]})}function zu({events:e,autoPlayToken:t}){let[n,r]=(0,v.useState)(!1),[i,a]=(0,v.useState)(e.length),[o,s]=(0,v.useState)(450);if((0,v.useEffect)(()=>{a(e.length),r(!1)},[e]),(0,v.useEffect)(()=>{!t||!e.length||(a(0),r(!0))},[t,e.length]),(0,v.useEffect)(()=>{if(!n)return;if(i>=e.length){r(!1);return}let t=window.setTimeout(()=>a(t=>Math.min(t+1,e.length)),o);return()=>window.clearTimeout(t)},[e.length,n,o,i]),!e.length)return null;let c=e.slice(0,i);return(0,R.jsxs)(`div`,{className:`tool-loop-trace`,"aria-label":`Runtime trace replay`,children:[(0,R.jsxs)(`div`,{className:`tool-loop-section-heading`,children:[(0,R.jsx)(`strong`,{children:`Runtime Trace`}),(0,R.jsxs)(`span`,{className:`muted`,children:[c.length,` / `,e.length,` events`]})]}),(0,R.jsxs)(`div`,{className:`tool-loop-trace-controls`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>{i>=e.length&&a(0),r(e=>!e)},children:n?`Pause`:`Replay`}),(0,R.jsx)(z,{type:`button`,onClick:()=>{a(0),r(!0)},children:`Restart`}),(0,R.jsxs)(`label`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Speed`}),(0,R.jsxs)(`select`,{value:o,onChange:e=>s(Number(e.target.value)),children:[(0,R.jsx)(`option`,{value:700,children:`Slow`}),(0,R.jsx)(`option`,{value:450,children:`Normal`}),(0,R.jsx)(`option`,{value:180,children:`Fast`})]})]})]}),(0,R.jsx)(`div`,{className:`tool-loop-trace-list`,children:c.map(e=>(0,R.jsxs)(`details`,{className:`tool-loop-trace-event ${e.status===`failed`?`failed`:``}`,children:[(0,R.jsxs)(`summary`,{children:[(0,R.jsx)(`span`,{className:`tool-loop-step-index`,children:e.sequence??`-`}),(0,R.jsx)(`span`,{className:`tool-loop-step-name`,children:e.title||e.event_type||`trace event`}),(0,R.jsx)(H,{tone:e.status===`failed`?`danger`:e.status===`passed`?`success`:`muted`,children:e.status||`running`})]}),(0,R.jsx)(`pre`,{className:`tool-loop-json`,children:Cu(e.payload||{})})]},e.id||`${e.sequence}-${e.event_type}`))})]})}function Bu(e=``){return j(`/audit/events${e}`)}function Vu(e){return Array.isArray(e)?e:e?.events||[]}function Hu(e){return e?new Date(e).toISOString():``}function Uu(){let{authUser:e}=U(),[t,n]=(0,v.useState)([]),[r,i]=(0,v.useState)(null),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(``),[d,f]=(0,v.useState)(``),[p,m]=(0,v.useState)(``),[h,g]=(0,v.useState)(200);function _(){let e=new URLSearchParams;return e.set(`limit`,String(h)),a.trim()&&e.set(`event_type`,a.trim()),s.trim()&&e.set(`target`,s.trim()),l&&e.set(`dry_run`,l),d&&e.set(`created_from`,Hu(d)),p&&e.set(`created_to`,Hu(p)),e}let{data:y,loading:b,error:x,refresh:S}=ua(()=>Bu(`?${_().toString()}`).then(Vu),[],[h,a,s,l,d,p]);(0,v.useEffect)(()=>{n(y)},[y]);let C=(0,v.useMemo)(()=>JSON.stringify(r||{},null,2),[r]);function w(){e&&n(y.filter(t=>String(t.actor||``)===e))}return(0,R.jsxs)(`div`,{className:`audit-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Security`}),(0,R.jsx)(`h2`,{children:`Audit`})]}),(0,R.jsx)(`span`,{className:`muted`,children:`Operational action log`})]}),(0,R.jsx)(pe,{message:x}),(0,R.jsx)(V,{children:(0,R.jsxs)(`div`,{className:`filter-bar`,children:[(0,R.jsx)(B,{label:`Event type`,children:(0,R.jsx)(`input`,{value:a,onChange:e=>o(e.target.value),placeholder:`event type`})}),(0,R.jsx)(B,{label:`Target`,children:(0,R.jsx)(`input`,{value:s,onChange:e=>c(e.target.value),placeholder:`target`})}),(0,R.jsx)(B,{label:`Dry run`,children:(0,R.jsxs)(`select`,{value:l,onChange:e=>u(e.target.value),children:[(0,R.jsx)(`option`,{value:``,children:`all`}),(0,R.jsx)(`option`,{value:`true`,children:`dry-run only`}),(0,R.jsx)(`option`,{value:`false`,children:`executed only`})]})}),(0,R.jsx)(B,{label:`From`,children:(0,R.jsx)(`input`,{type:`datetime-local`,value:d,onChange:e=>f(e.target.value)})}),(0,R.jsx)(B,{label:`To`,children:(0,R.jsx)(`input`,{type:`datetime-local`,value:p,onChange:e=>m(e.target.value)})}),(0,R.jsx)(B,{label:`Limit`,children:(0,R.jsx)(`input`,{type:`number`,min:1,max:1e3,value:h,onChange:e=>g(Number(e.target.value))})}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>void S(),children:b?`Refreshing`:`Refresh Audit`}),(0,R.jsx)(`button`,{type:`button`,onClick:w,children:`My Actions`})]})}),(0,R.jsxs)(`div`,{className:`controller-grid-react`,children:[(0,R.jsx)(V,{title:`Events`,children:(0,R.jsx)(fe,{rows:t,emptyMessage:`No audit events.`,getRowKey:(e,t)=>K(e,`id`,String(t)),columns:[{key:`time`,header:`Time`,render:e=>K(e,`created_at`)},{key:`type`,header:`Type`,render:e=>K(e,`event_type`)},{key:`dry`,header:`Dry`,render:e=>String(!!e.dry_run)},{key:`target`,header:`Target`,render:e=>K(e,`target`)},{key:`route`,header:`Route`,render:e=>K(e,`route`)},{key:`action`,header:`Action`,render:e=>(0,R.jsx)(`button`,{type:`button`,"aria-label":`View ${K(e,`id`)}`,onClick:()=>i(e),children:`View`})}]})}),(0,R.jsx)(V,{title:`Event Detail`,children:(0,R.jsx)(`pre`,{className:`detail-json tall-json`,children:r?C:`Select an event to inspect payload details.`})})]})]})}function Wu(e=!1){return j(`/benchmarks/definitions${e?`?include_archived=true`:``}`)}function Gu(e){return M(`/benchmarks/definitions`,e)}function Ku(e,t=50){let n=new URLSearchParams;return e&&n.set(`definition_id`,e),n.set(`limit`,String(t)),j(`/benchmarks/runs?${n}`)}function qu(e){return j(`/benchmarks/runs/${encodeURIComponent(e)}`)}function Ju(e){return M(`/benchmarks/runs`,e)}function Yu(e){return M(`/benchmarks/runs/compare`,{run_ids:e})}var Xu=[`completed`,`failed`,`partial`];function Zu(e){return String(e.name||e.id||e.model||``)}function Qu(e){let t=e.node||e.node_name;return t?`node:${t}`:`local`}function $u(e){return Array.isArray(e)?e:e?.nodes||[]}function ed(e){return $u(e).flatMap(e=>{let t=String(e.name||``);return!t||e.reachable===!1||!Array.isArray(e.models)?[]:e.models.map(e=>({...e,node:t}))}).filter(e=>Zu(e))}var td=2500;function nd(e){return e.charAt(0).toUpperCase()+e.slice(1)}function rd(e){return e===`completed`?`status-ok`:e===`failed`?`status-fail`:e===`partial`?`status-warn`:`status-pending`}function id(e,t=1){return e==null?`—`:e.toFixed(t)}function ad({value:e,max:t,color:n}){let r=t>0&&e!=null?Math.max(0,Math.min(100,e/t*100)):0;return(0,R.jsxs)(`svg`,{className:`metric-bar-svg`,viewBox:`0 0 100 12`,preserveAspectRatio:`none`,"aria-hidden":`true`,children:[(0,R.jsx)(`rect`,{x:`0`,y:`2`,width:`100`,height:`8`,fill:`var(--color-surface-2, #eee)`,rx:`2`}),(0,R.jsx)(`rect`,{x:`0`,y:`2`,width:r,height:`8`,fill:n,rx:`2`})]})}function od({run:e,maxTtft:t,maxTps:n}){let r=e.aggregate??null;return(0,R.jsxs)(`tr`,{children:[(0,R.jsx)(`td`,{children:e.model}),(0,R.jsx)(`td`,{children:(0,R.jsx)(`span`,{className:`bench-status ${rd(e.status)}`,children:nd(e.status)})}),(0,R.jsx)(`td`,{children:(0,R.jsxs)(`div`,{className:`metric-cell`,children:[(0,R.jsxs)(`span`,{children:[id(r?.ttft_ms_median),` ms`]}),(0,R.jsx)(ad,{value:r?.ttft_ms_median,max:t,color:`var(--color-accent, #7c6cf0)`})]})}),(0,R.jsx)(`td`,{children:(0,R.jsxs)(`div`,{className:`metric-cell`,children:[(0,R.jsxs)(`span`,{children:[id(r?.tokens_per_second_median),` tok/s`]}),(0,R.jsx)(ad,{value:r?.tokens_per_second_median,max:n,color:`var(--color-success, #3dba78)`})]})}),(0,R.jsxs)(`td`,{children:[id(r?.total_duration_ms_median),` ms`]}),(0,R.jsx)(`td`,{children:r?.success_rate==null?`—`:`${(r.success_rate*100).toFixed(0)}%`}),(0,R.jsx)(`td`,{className:`muted`,children:e.started_at?new Date(e.started_at).toLocaleString():`—`})]})}function sd({onCreated:e}){let[t,n]=(0,v.useState)(``),[r,i]=(0,v.useState)(``),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(3),[l,u]=(0,v.useState)(256),[d,f]=(0,v.useState)(!1),[p,m]=(0,v.useState)(``);async function h(c){c.preventDefault(),m(``),f(!0);try{e(await Gu({name:t.trim(),prompt_text:r.trim(),system_prompt:a.trim()||void 0,sample_count:s,max_tokens:l})),n(``),i(``),o(``)}catch(e){m(e instanceof Error?e.message:`Failed to create definition`)}finally{f(!1)}}return(0,R.jsxs)(`form`,{className:`create-definition-form`,onSubmit:e=>void h(e),children:[(0,R.jsx)(pe,{message:p}),(0,R.jsx)(B,{label:`Name`,children:(0,R.jsx)(`input`,{value:t,onChange:e=>n(e.target.value),placeholder:`e.g. My Custom Benchmark`,required:!0})}),(0,R.jsx)(B,{label:`Prompt text`,children:(0,R.jsx)(`textarea`,{value:r,onChange:e=>i(e.target.value),rows:3,placeholder:`User prompt to benchmark`,required:!0})}),(0,R.jsx)(B,{label:`System prompt (optional)`,children:(0,R.jsx)(`textarea`,{value:a,onChange:e=>o(e.target.value),rows:2,placeholder:`Optional system prompt`})}),(0,R.jsxs)(`div`,{className:`create-form-row`,children:[(0,R.jsx)(B,{label:`Samples`,children:(0,R.jsx)(`input`,{type:`number`,min:1,max:20,value:s,onChange:e=>c(Number(e.target.value))})}),(0,R.jsx)(B,{label:`Max tokens`,children:(0,R.jsx)(`input`,{type:`number`,min:1,max:4096,value:l,onChange:e=>u(Number(e.target.value))})})]}),(0,R.jsx)(`button`,{type:`submit`,disabled:d,children:d?`Creating…`:`Create Definition`})]})}function cd(){let e=$a(),[t,n]=(0,v.useState)([]),[r,i]=(0,v.useState)(``),[a,o]=(0,v.useState)([]),[s,c]=(0,v.useState)([]),[l,u]=(0,v.useState)(()=>new Set(e.model?[e.model]:[])),[d,f]=(0,v.useState)(e.target||`auto`),[p,m]=(0,v.useState)(!!e.targetNode),[h,g]=(0,v.useState)(e.targetNode),[_,y]=(0,v.useState)(!1),[b,x]=(0,v.useState)(``),[S,C]=(0,v.useState)(!0),[w,T]=(0,v.useState)(!1),[E,D]=(0,v.useState)(!1),[O,k]=(0,v.useState)(new Set),[A,ee]=(0,v.useState)(null),j=(0,v.useRef)(null),M=(0,v.useCallback)(async()=>{C(!0);try{let e=await Wu();n(e.definitions??[]),!r&&e.definitions?.length&&i(e.definitions[0].id)}catch(e){x(e instanceof Error?e.message:`Failed to load definitions`)}finally{C(!1)}},[r]),te=(0,v.useCallback)(async e=>{if(e)try{o((await Ku(e,100)).runs??[])}catch(e){x(e instanceof Error?e.message:`Failed to load runs`)}},[]),N=(0,v.useCallback)(async()=>{try{c(ed(await mi()))}catch{}},[]);(0,v.useEffect)(()=>{M(),N()},[M,N]),(0,v.useEffect)(()=>{r&&te(r)},[r,te]),(0,v.useEffect)(()=>{function e(){j.current!==null&&(clearInterval(j.current),j.current=null)}let t=a.filter(e=>!Xu.includes(e.status)).map(e=>e.id);if(t.length===0){e();return}if(j.current===null)return j.current=setInterval(()=>{Promise.all(t.map(e=>qu(e))).then(t=>{o(e=>{let n=new Map(e.map(e=>[e.id,e]));for(let e of t)n.set(e.id,e);return Array.from(n.values())}),t.every(e=>Xu.includes(e.status))&&e()})},td),e},[a]);async function P(){if(!(!r||l.size===0)){if(p&&!h){x(`Select a target node for managed loading`);return}x(``),T(!0);try{let e=await Ju({definition_id:r,models:Array.from(l),target_selector:d||`auto`,target_node:p?h:void 0,managed_load:p,restore_after:p?_:!1});o(t=>[...e.runs??[],...t])}catch(e){x(e instanceof Error?e.message:`Failed to start runs`)}finally{T(!1)}}}async function F(){if(!(O.size<2)){x(``);try{ee((await Yu(Array.from(O))).runs??[])}catch(e){x(e instanceof Error?e.message:`Failed to compare runs`)}}}function ne(e){ee(null),k(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}function re(e){u(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}let ie=t.find(e=>e.id===r)??null,I=A??a,ae=Math.max(1,...I.map(e=>e.aggregate?.ttft_ms_median??0)),L=Math.max(1,...I.map(e=>e.aggregate?.tokens_per_second_median??0)),oe=s.map(Zu).filter(Boolean),se=[`auto`,d,...Array.from(new Set(s.map(Qu))).filter(Boolean)].filter((e,t,n)=>e&&n.indexOf(e)===t),ce=Array.from(new Set([h,...s.map(e=>String(e.node||e.node_name||``))].filter(Boolean)));return(0,R.jsxs)(`div`,{className:`benchmarks-page`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Performance`}),(0,R.jsx)(`h2`,{children:`Benchmarks`})]}),(0,R.jsx)(`span`,{className:`muted`,children:`Run repeatable inference tests and compare results`})]}),(0,R.jsx)(pe,{message:b}),(0,R.jsxs)(`div`,{className:`benchmarks-layout`,children:[(0,R.jsxs)(`div`,{className:`benchmarks-sidebar`,children:[(0,R.jsx)(V,{title:`Benchmark Definition`,children:S?(0,R.jsx)(`p`,{className:`muted`,children:`Loading…`}):(0,R.jsxs)(`div`,{className:`definition-selector`,children:[(0,R.jsx)(B,{label:`Select definition`,children:(0,R.jsx)(`select`,{value:r,onChange:e=>{i(e.target.value),ee(null),k(new Set)},children:t.map(e=>(0,R.jsx)(`option`,{value:e.id,children:e.name},e.id))})}),ie&&(0,R.jsxs)(`div`,{className:`definition-detail`,children:[ie.description&&(0,R.jsx)(`p`,{className:`muted`,children:ie.description}),ie.tags.length>0&&(0,R.jsx)(`div`,{className:`definition-tags`,"aria-label":`Benchmark tags`,children:ie.tags.map(e=>(0,R.jsx)(`span`,{className:`definition-tag`,children:e},e))}),(0,R.jsxs)(`p`,{children:[(0,R.jsx)(`span`,{className:`label`,children:`Prompt:`}),` `,(0,R.jsx)(`span`,{className:`prompt-preview`,children:ie.prompt_text})]}),(0,R.jsxs)(`p`,{children:[(0,R.jsx)(`span`,{className:`label`,children:`Samples:`}),` `,ie.sample_count,`  `,(0,R.jsx)(`span`,{className:`label`,children:`Max tokens:`}),` `,ie.max_tokens]})]}),(0,R.jsx)(z,{variant:`link`,type:`button`,onClick:()=>D(e=>!e),children:E?`Cancel`:`+ New definition`}),E&&(0,R.jsx)(sd,{onCreated:e=>{n(t=>[e,...t]),i(e.id),D(!1)}})]})}),(0,R.jsxs)(V,{title:`Run`,children:[(0,R.jsx)(B,{label:`Models to benchmark`,children:oe.length===0?(0,R.jsx)(`p`,{className:`muted`,children:`No models discovered`}):(0,R.jsx)(`div`,{className:`model-checkboxes`,children:oe.map(e=>(0,R.jsxs)(`label`,{className:`model-checkbox-label`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:l.has(e),onChange:()=>re(e)}),e]},e))})}),(0,R.jsx)(B,{label:`Target`,children:(0,R.jsx)(`select`,{value:d,onChange:e=>f(e.target.value),disabled:p,children:se.map(e=>(0,R.jsx)(`option`,{value:e,children:e},e))})}),(0,R.jsxs)(`label`,{className:`benchmark-option`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:p,onChange:e=>{m(e.target.checked),e.target.checked&&!h&&ce.length>0&&g(ce[0])}}),(0,R.jsx)(`span`,{children:`Load model on a node before running`})]}),p&&(0,R.jsxs)(R.Fragment,{children:[(0,R.jsx)(B,{label:`Target node`,children:(0,R.jsxs)(`select`,{value:h,onChange:e=>g(e.target.value),children:[(0,R.jsx)(`option`,{value:``,disabled:!0,children:`Select node`}),ce.map(e=>(0,R.jsx)(`option`,{value:e,children:e},e))]})}),(0,R.jsxs)(`label`,{className:`benchmark-option`,children:[(0,R.jsx)(`input`,{type:`checkbox`,checked:_,onChange:e=>y(e.target.checked)}),(0,R.jsx)(`span`,{children:`Restore previously running models after benchmark`})]})]}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>void P(),disabled:w||!r||l.size===0||p&&!h,children:w?`Starting…`:`Run Benchmark`})]})]}),(0,R.jsxs)(`div`,{className:`benchmarks-results`,children:[(0,R.jsxs)(V,{title:`Results${ie?` — ${ie.name}`:``}`,actions:O.size>=2?(0,R.jsxs)(`button`,{type:`button`,onClick:()=>void F(),children:[`Compare `,O.size,` runs`]}):A?(0,R.jsx)(`button`,{type:`button`,onClick:()=>{ee(null),k(new Set)},children:`Clear comparison`}):void 0,children:[A&&(0,R.jsxs)(`p`,{className:`muted compare-notice`,children:[`Showing comparison of `,A.length,` selected runs from the same definition.`]}),I.length===0?(0,R.jsx)(`p`,{className:`muted`,children:`No runs yet. Select a definition and models, then click Run Benchmark.`}):(0,R.jsx)(`div`,{className:`results-table-wrap`,children:(0,R.jsxs)(`table`,{className:`bench-results-table`,children:[(0,R.jsx)(`thead`,{children:(0,R.jsxs)(`tr`,{children:[(0,R.jsx)(`th`,{}),(0,R.jsx)(`th`,{children:`Model`}),(0,R.jsx)(`th`,{children:`Status`}),(0,R.jsx)(`th`,{children:`TTFT (median)`}),(0,R.jsx)(`th`,{children:`Tok/s (median)`}),(0,R.jsx)(`th`,{children:`Duration (median)`}),(0,R.jsx)(`th`,{children:`Success rate`}),(0,R.jsx)(`th`,{children:`Started`})]})}),(0,R.jsx)(`tbody`,{children:I.map(e=>(0,R.jsxs)(`tr`,{children:[(0,R.jsx)(`td`,{children:(0,R.jsx)(`input`,{type:`checkbox`,checked:O.has(e.id),onChange:()=>ne(e.id),title:`Select for comparison`})}),(0,R.jsx)(`td`,{children:e.model}),(0,R.jsx)(`td`,{children:(0,R.jsx)(`span`,{className:`bench-status ${rd(e.status)}`,children:nd(e.status)})}),(0,R.jsx)(`td`,{children:(0,R.jsxs)(`div`,{className:`metric-cell`,children:[(0,R.jsxs)(`span`,{children:[id(e.aggregate?.ttft_ms_median),` ms`]}),(0,R.jsx)(ad,{value:e.aggregate?.ttft_ms_median,max:ae,color:`var(--color-accent, #7c6cf0)`})]})}),(0,R.jsx)(`td`,{children:(0,R.jsxs)(`div`,{className:`metric-cell`,children:[(0,R.jsxs)(`span`,{children:[id(e.aggregate?.tokens_per_second_median),` tok/s`]}),(0,R.jsx)(ad,{value:e.aggregate?.tokens_per_second_median,max:L,color:`var(--color-success, #3dba78)`})]})}),(0,R.jsxs)(`td`,{children:[id(e.aggregate?.total_duration_ms_median),` ms`]}),(0,R.jsx)(`td`,{children:e.aggregate?.success_rate==null?`—`:`${(e.aggregate.success_rate*100).toFixed(0)}%`}),(0,R.jsx)(`td`,{className:`muted`,children:e.started_at?new Date(e.started_at).toLocaleString():`—`})]},e.id))})]})})]}),(A??(O.size>=2?[]:null))!==null&&A&&A.length>=2&&(0,R.jsx)(V,{title:`Comparison charts`,children:(0,R.jsxs)(`div`,{className:`chart-section`,children:[(0,R.jsx)(`h3`,{children:`TTFT — median (ms) · lower is better`}),(0,R.jsx)(`div`,{className:`chart-bars`,children:A.map(e=>(0,R.jsx)(od,{run:e,maxTtft:ae,maxTps:L},e.id))})]})})]})]})]})}function ld(){return j(`/external-keys`)}function ud(e){return M(`/external-keys`,e)}function dd(e){return M(`/external-keys/${encodeURIComponent(e)}/revoke`)}function fd(e){return j(`/external-keys/${encodeURIComponent(e)}/analytics`)}function pd(e){return e?new Date(e).toLocaleString():`-`}function md(e){if(!e.last_used_route&&!e.last_used_model)return`-`;let t=e.last_used_route||e.last_used_node||`unknown route`;return e.last_used_model?`${t} · ${e.last_used_model}`:t}function hd(e){let t=Object.entries(e||{}).sort((e,t)=>t[1]-e[1]);return t.length===0?`-`:t.slice(0,3).map(([e,t])=>`${e} (${t})`).join(`, `)}function gd({created:e,onDismiss:t}){let[n,r]=(0,v.useState)(!1),i=(0,v.useRef)(null);function a(){let t=e.key||``;navigator.clipboard.writeText(t).then(()=>{r(!0),setTimeout(()=>r(!1),2500)})}return(0,R.jsxs)(`div`,{className:`api-key-reveal-banner`,role:`alert`,children:[(0,R.jsxs)(`div`,{className:`api-key-reveal-header`,children:[(0,R.jsx)(`strong`,{children:`API key generated — copy it now`}),(0,R.jsx)(`span`,{className:`muted api-key-reveal-warning`,children:`This key will not be shown again.`})]}),(0,R.jsxs)(`div`,{className:`api-key-reveal-row`,children:[(0,R.jsx)(`input`,{ref:i,className:`api-key-reveal-input`,type:`text`,readOnly:!0,value:e.key||``,onFocus:e=>e.currentTarget.select(),"aria-label":`Generated API key`}),(0,R.jsx)(z,{variant:`primary`,size:`sm`,onClick:a,children:n?`Copied!`:`Copy`})]}),(0,R.jsxs)(`div`,{className:`api-key-reveal-meta muted`,children:[`Site: `,(0,R.jsx)(`strong`,{children:e.site_name}),e.site_url?(0,R.jsxs)(R.Fragment,{children:[` · `,(0,R.jsx)(`a`,{href:e.site_url,target:`_blank`,rel:`noopener noreferrer`,children:e.site_url})]}):null]}),(0,R.jsxs)(`div`,{className:`api-key-reveal-hint muted`,children:[`Send as `,(0,R.jsxs)(`code`,{children:[`X-Llama-Manager-Key: `,e.key]}),` on requests to`,` `,(0,R.jsx)(`code`,{children:`POST /v1/chat/completions`}),` or `,(0,R.jsx)(`code`,{children:`POST /api/chat`}),`.`]}),(0,R.jsx)(z,{variant:`ghost`,size:`sm`,className:`api-key-reveal-dismiss`,onClick:t,children:`I've copied the key — dismiss`})]})}function _d({selectedKey:e,analytics:t,loading:n,error:r,onClose:i}){return(0,R.jsxs)(me,{title:e?`${e.site_name||`External app`} analytics`:`External app analytics`,open:!!e,onClose:i,children:[r?(0,R.jsx)(pe,{message:r}):null,n?(0,R.jsx)(`p`,{className:`muted`,children:`Loading analytics...`}):null,!n&&t?(0,R.jsxs)(`div`,{className:`api-key-analytics`,children:[(0,R.jsxs)(`div`,{className:`api-key-metrics`,children:[(0,R.jsxs)(`div`,{className:`api-key-metric`,children:[(0,R.jsx)(`span`,{className:`muted`,children:`Total calls`}),(0,R.jsx)(`strong`,{children:t.total_calls||0})]}),(0,R.jsxs)(`div`,{className:`api-key-metric`,children:[(0,R.jsx)(`span`,{className:`muted`,children:`Endpoints`}),(0,R.jsx)(`strong`,{children:hd(t.endpoint_counts)})]}),(0,R.jsxs)(`div`,{className:`api-key-metric`,children:[(0,R.jsx)(`span`,{className:`muted`,children:`Models`}),(0,R.jsx)(`strong`,{children:hd(t.model_counts)})]}),(0,R.jsxs)(`div`,{className:`api-key-metric`,children:[(0,R.jsx)(`span`,{className:`muted`,children:`Request types`}),(0,R.jsx)(`strong`,{children:hd(t.request_type_counts)})]})]}),(0,R.jsxs)(`div`,{className:`api-key-analytics-section`,children:[(0,R.jsx)(`h3`,{children:`Recent calls`}),(0,R.jsx)(fe,{rows:t.recent_calls||[],emptyMessage:`No external calls recorded for this key.`,getRowKey:(e,t)=>`${e.created_at||`call`}-${t}`,columns:[{key:`created_at`,header:`Time`,render:e=>pd(e.created_at)},{key:`endpoint`,header:`Endpoint`,render:e=>String(e.endpoint||`-`)},{key:`model`,header:`Model`,render:e=>String(e.model||`-`)},{key:`route`,header:`Route`,render:e=>String(e.route||e.node||`-`)},{key:`request_type`,header:`Type`,render:e=>String(e.request_type||`-`)}]})]})]}):null]})}function vd(){let{data:e,loading:t,error:n,refresh:r,setError:i}=ua(()=>ld().then(e=>e.keys||[]),[]),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(!1),[d,f]=(0,v.useState)(null),[p,m]=(0,v.useState)(null),[h,g]=(0,v.useState)(null),[_,y]=(0,v.useState)(!1),[b,x]=(0,v.useState)(``);async function S(e){e.preventDefault();let t=a.trim(),n=s.trim();if(!t||!n){i(`Site name and site URL are required.`);return}u(!0),i(``),f(null);try{f(await ud({site_name:t,site_url:n})),o(``),c(``),await r()}catch(e){i(e instanceof Error?e.message:`Failed to generate API key`)}finally{u(!1)}}async function C(e){i(``);try{await dd(e),await r()}catch(e){i(e instanceof Error?e.message:`Failed to revoke API key`)}}async function w(e){if(e.id){m(e),g(null),x(``),y(!0);try{g(await fd(e.id))}catch(e){x(e instanceof Error?e.message:`Failed to load key analytics`)}finally{y(!1)}}}let T=e.filter(e=>!e.revoked),E=e.filter(e=>e.revoked);return(0,R.jsxs)(`div`,{className:`api-keys-page`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Gateway Access`}),(0,R.jsx)(`h2`,{children:`External App Keys`})]}),(0,R.jsx)(`span`,{className:`muted`,children:`Issue chat-only keys for apps that should call completions without managing infrastructure`})]}),(0,R.jsx)(pe,{message:n}),d?(0,R.jsx)(gd,{created:d,onDismiss:()=>f(null)}):null,(0,R.jsx)(V,{eyebrow:`New key`,title:`Generate external app key`,children:(0,R.jsxs)(`form`,{className:`api-key-form`,onSubmit:S,children:[(0,R.jsxs)(`div`,{className:`api-key-form-fields`,children:[(0,R.jsx)(B,{label:`Site name`,children:(0,R.jsx)(`input`,{className:`input`,type:`text`,placeholder:`My Application`,value:a,onChange:e=>o(e.target.value),required:!0,maxLength:120,autoComplete:`off`})}),(0,R.jsx)(B,{label:`Site URL`,hint:`Used for display only; not validated as a callback.`,children:(0,R.jsx)(`input`,{className:`input`,type:`url`,placeholder:`https://example.com`,value:s,onChange:e=>c(e.target.value),required:!0,maxLength:512,autoComplete:`off`})})]}),(0,R.jsx)(z,{type:`submit`,variant:`primary`,size:`md`,disabled:l,children:l?`Generating…`:`Generate external app key`})]})}),(0,R.jsx)(V,{eyebrow:`Active`,title:`External app keys`,actions:(0,R.jsx)(z,{variant:`ghost`,size:`sm`,onClick:r,disabled:t,children:`Refresh`}),children:(0,R.jsx)(fe,{columns:[{key:`site_name`,header:`Site name`,render:e=>(0,R.jsx)(`button`,{type:`button`,className:`api-key-link-button`,onClick:()=>void w(e),children:String(e.site_name||`-`)})},{key:`site_url`,header:`Site URL`,render:e=>e.site_url?(0,R.jsx)(`a`,{href:e.site_url,target:`_blank`,rel:`noopener noreferrer`,className:`api-key-url-link`,children:e.site_url}):`-`},{key:`key_hint`,header:`Key hint`,render:e=>(0,R.jsx)(`code`,{children:String(e.key_hint||`-`)})},{key:`created_at`,header:`Created`,render:e=>pd(e.created_at)},{key:`last_used_at`,header:`Last used`,render:e=>pd(e.last_used_at)},{key:`last_used_route`,header:`Last route`,render:e=>md(e)},{key:`last_used_endpoint`,header:`Endpoint`,render:e=>String(e.last_used_endpoint||`-`)},{key:`actions`,header:``,render:e=>e.id?(0,R.jsxs)(`div`,{className:`api-key-actions`,children:[(0,R.jsx)(z,{variant:`ghost`,size:`sm`,onClick:()=>void w(e),children:`Analytics`}),(0,R.jsx)(z,{variant:`danger`,size:`sm`,onClick:()=>C(e.id),children:`Revoke`})]}):null}],rows:T,emptyMessage:`No active external app keys. Generate one above.`,getRowKey:(e,t)=>e.id||String(t)})}),E.length>0?(0,R.jsx)(V,{eyebrow:`History`,title:`Revoked keys`,children:(0,R.jsx)(fe,{columns:[{key:`site_name`,header:`Site name`,render:e=>String(e.site_name||`-`)},{key:`site_url`,header:`Site URL`,render:e=>String(e.site_url||`-`)},{key:`key_hint`,header:`Key hint`,render:e=>(0,R.jsx)(`code`,{children:String(e.key_hint||`-`)})},{key:`last_used_at`,header:`Last used`,render:e=>pd(e.last_used_at)},{key:`created_at`,header:`Created`,render:e=>pd(e.created_at)}],rows:E,emptyMessage:``,getRowKey:(e,t)=>e.id||String(t)})}):null,(0,R.jsx)(_d,{selectedKey:p,analytics:h,loading:_,error:b,onClose:()=>m(null)})]})}function yd(e,t,n){let r=new Map(e.map(e=>[e.id,e])),i=t?.plugins||[],a=new Set([...r.keys(),...i.map(e=>e.id)]);return Array.from(a).sort().map(e=>{let t=r.get(e),a=i.find(t=>t.id===e);return{id:e,name:t?.name||e,version:a?.version||t?.version||``,status:a?.status||t?.status||`unknown`,frontendEntry:t?.frontend?.entry||null,routes:t?.frontend?.pages?.length?t.frontend.pages.map(e=>e.route):[...t?.navigation||[],...t?.ui_routes||[]].map(e=>e.path).filter(e=>typeof e==`string`&&e.length>0),warnings:a?.warnings||[],errors:a?.errors||[],health:a?.health||[],config:a?.config,migrationStatus:n[e]}})}function bd(e,t=`None`){return e.length?e.join(`, `):t}function xd(e){return e.status===`enabled`?`Deactivate`:`Activate`}async function Sd(){let[e,t]=await Promise.all([Di(),Oi()]),n=Array.isArray(e)?e:[],r=new Set([...n.map(e=>e.id),...(t.plugins||[]).map(e=>e.id)]),i=await Promise.all(Array.from(r).sort().map(async e=>{try{return[e,await ki(e)]}catch{return[e,null]}}));return yd(n,t,Object.fromEntries(i))}function Y(e){if(!e)return`Unavailable`;if(!e.targets.length)return`No targets`;let t=e.targets.filter(e=>e.pending).length;return t?`${t} pending`:`Current`}function Cd(e){return e===`enabled`?`success`:e===`disabled`?`muted`:e===`incompatible`?`warning`:`danger`}function wd(){let{data:e,loading:t,error:n,refresh:r,setError:i}=ua(Sd,[]),[a,o]=(0,v.useState)(``),[s,c]=(0,v.useState)(``),[l,u]=(0,v.useState)(``),[d,f]=(0,v.useState)(``),p=e.find(e=>e.id===a)||e[0];async function m(e){let t=xd(e);c(e.id),i(``),f(``);try{e.status===`enabled`?await Mi(e.id):await ji(e.id),await r()}catch(e){i(e instanceof Error?e.message:`Failed to ${t.toLowerCase()} plugin`)}finally{c(``)}}async function h(e,t){u(`${e}:${t}`),i(``),f(``);try{await Ai(e,t),await r(),f(`Upgrade complete`)}catch(e){i(e instanceof Error?e.message:`Failed to upgrade migration target`),await r()}finally{u(``)}}return(0,R.jsxs)(`div`,{className:`plugins-page`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Extensions`}),(0,R.jsx)(`h2`,{children:`Plugins`}),(0,R.jsx)(`p`,{className:`muted`,children:`Runtime metadata, health, assets, and migration status for configured plugins.`})]}),(0,R.jsx)(z,{type:`button`,onClick:()=>void r(),disabled:t,children:t?`Refreshing`:`Refresh`})]}),n?(0,R.jsx)(pe,{message:n}):null,(0,R.jsx)(V,{title:`Configured Plugins`,eyebrow:`Status`,children:(0,R.jsx)(fe,{rows:e,emptyMessage:t?`Loading plugins...`:`No plugins configured.`,getRowKey:e=>e.id,columns:[{key:`id`,header:`Plugin`,render:e=>(0,R.jsxs)(`div`,{className:`plugin-list-item`,children:[(0,R.jsx)(`button`,{className:`table-link-button plugin-list-name`,type:`button`,onClick:()=>o(e.id),children:e.name}),(0,R.jsx)(`span`,{className:`muted`,children:e.id}),(0,R.jsxs)(`div`,{className:`plugin-row-actions`,children:[(0,R.jsx)(`button`,{className:e.status===`enabled`?`plugin-action plugin-action-danger`:`plugin-action`,type:`button`,onClick:()=>void m(e),disabled:t||s===e.id,children:s===e.id?`Working`:xd(e)}),(0,R.jsx)(`button`,{className:`plugin-action`,type:`button`,onClick:()=>o(e.id),children:`Details`})]})]})},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:Cd(e.status),children:e.status})},{key:`version`,header:`Version`,render:e=>e.version||`-`},{key:`routes`,header:`Routes`,render:e=>e.routes.length},{key:`migrations`,header:`Migrations`,render:e=>Y(e.migrationStatus)},{key:`issues`,header:`Issues`,render:e=>e.errors.length+e.warnings.length}]})}),p?(0,R.jsxs)(V,{title:p.name,eyebrow:`Detail`,actions:(0,R.jsx)(z,{type:`button`,onClick:()=>void m(p),disabled:t||s===p.id,children:s===p.id?`Working`:xd(p)}),children:[(0,R.jsxs)(`div`,{className:`detail-grid`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`ID`}),(0,R.jsx)(`strong`,{children:p.id})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Version`}),(0,R.jsx)(`strong`,{children:p.version||`-`})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Status`}),(0,R.jsx)(H,{tone:Cd(p.status),children:p.status})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Frontend entry`}),(0,R.jsx)(`strong`,{children:p.frontendEntry||`-`})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Routes`}),(0,R.jsx)(`strong`,{children:bd(p.routes)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Warnings`}),(0,R.jsx)(`strong`,{children:bd(p.warnings)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Errors`}),(0,R.jsx)(`strong`,{children:bd(p.errors)})]}),(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`muted`,children:`Config`}),(0,R.jsx)(`strong`,{children:p.config?JSON.stringify(p.config):`{}`})]})]}),(0,R.jsx)(`h4`,{children:`Health`}),(0,R.jsx)(fe,{rows:p.health,emptyMessage:`No health entries.`,getRowKey:(e,t)=>`${e.level||`entry`}-${t}`,columns:[{key:`level`,header:`Level`,render:e=>(0,R.jsx)(H,{tone:String(e.level)===`error`?`danger`:String(e.level)===`warning`?`warning`:`success`,children:String(e.level||`ok`)})},{key:`message`,header:`Message`,render:e=>String(e.message||``)}]}),(0,R.jsx)(`h4`,{children:`Migrations`}),d?(0,R.jsx)(`p`,{className:`muted`,children:d}):null,(0,R.jsx)(fe,{rows:p.migrationStatus?.targets||[],emptyMessage:`No migration targets.`,getRowKey:e=>e.id,columns:[{key:`id`,header:`Target`,render:e=>e.id},{key:`status`,header:`Status`,render:e=>(0,R.jsx)(H,{tone:e.pending?`warning`:e.status===`current`?`success`:`muted`,children:e.status})},{key:`current`,header:`Current`,render:e=>e.current_revision||`-`},{key:`head`,header:`Head`,render:e=>e.head_revision||`-`},{key:`last_error`,header:`Last error`,render:e=>e.last_error||`-`},{key:`directory`,header:`Directory`,render:e=>e.directory},{key:`actions`,header:`Actions`,render:e=>{let n=`${p.id}:${e.id}`;return e.pending?(0,R.jsx)(`button`,{className:`plugin-action`,type:`button`,onClick:()=>void h(p.id,e.id),disabled:t||l===n,children:l===n?`Upgrading`:`Upgrade`}):`-`}}]})]}):null]})}function Td(e,t){let n=t.startsWith(`/`)?t:`/${t}`;return`/plugins/${encodeURIComponent(e)}${n}`}function Ed({pluginId:e,navigate:t,refreshPluginStatus:n}){return{pluginId:e,apiGet:t=>j(Td(e,t)),apiPost:(t,n)=>M(Td(e,t),n),apiPut:(t,n)=>N(Td(e,t),n),apiDelete:t=>F(Td(e,t)),navigate:t,refreshPluginStatus:n}}var Dd=e=>nt(()=>import(e),[]);function Od(e,t,n){return`${e}${e.includes(`?`)?`&`:`?`}v=${encodeURIComponent(t||`dev`)}&r=${encodeURIComponent(String(n))}`}function kd(e,t){return e instanceof Error?e.message:t}function Ad({loadModule:e=Dd}={}){let{pluginId:t}=On(),n=wn(),r=xn(),{refreshKey:i}=Ci(),{pluginPages:a}=Ii(),o=(0,v.useMemo)(()=>a.find(e=>e.pluginId===t&&e.path===r.pathname)||{key:`plugin:${t}:${r.pathname}`,label:`Plugin`,path:r.pathname,icon:`settings`,section:`plugins`,pluginId:t||``,pluginName:`Plugin`},[t,a,r.pathname]),s=(0,v.useRef)(null),c=(0,v.useRef)(null),l=(0,v.useRef)(``),u=(0,v.useRef)([]),[d,f]=(0,v.useState)(0),p=(0,v.useCallback)(async()=>o.pluginId&&(await Di()).find(e=>e.id===o.pluginId)||null,[o.pluginId]),{data:m,loading:h,error:g,setError:_}=ua(p,null,[p]),y=(0,v.useMemo)(()=>(m?.frontend?.pages||[]).find(e=>e.route===r.pathname)||null,[m,r.pathname]),b=(0,v.useMemo)(()=>Ed({pluginId:o.pluginId||``,navigate:n,refreshPluginStatus:()=>void 0}),[n,o.pluginId]);function x(){let e=c.current;if(c.current=null,!e)return``;try{return e(),``}catch(e){return kd(e,`Plugin cleanup failed`)}}function S(){for(let e of u.current)e.remove();u.current=[]}function C(e,t){S();for(let n of e){let e=document.createElement(`link`);e.rel=`stylesheet`,e.href=Od(n,t,d),e.dataset.pluginStyle=o.pluginId,document.head.appendChild(e),u.current.push(e)}}return(0,v.useEffect)(()=>{if(!o.pluginId||!m)return;let t=l.current||x();l.current=``,s.current&&(s.current.innerHTML=``),C(m.frontend?.style_entries||[],m.version);let n=y;if(n){_(t);let r=!1;return fetch(n.template).then(async e=>{if(!e.ok)throw Error(`Plugin template unavailable: ${e.status} ${e.statusText}`);return e.text()}).then(async t=>{if(r||!s.current||(s.current.innerHTML=t,!n.controller))return;let i=await e(Od(n.controller,m.version,d));if(r||!s.current)return;if(typeof i.mountPage!=`function`){_(`Plugin ${o.pluginId} controller does not export mountPage()`);return}let a=i.mountPage(s.current,b);c.current=typeof a==`function`?a:null}).catch(e=>{if(!r){let n=kd(e,`Plugin page unavailable`);_(t?`${t}; ${n}`:n)}}),()=>{r=!0;let e=x();e&&(l.current=e),S()}}let r=m?.frontend?.entry;if(!r)return _(`Plugin ${o.pluginId} does not declare a frontend entry`),()=>S();_(t);let i=!1;return e(Od(r,m.version,d)).then(e=>{if(i||!s.current||typeof e.mount!=`function`){!i&&typeof e.mount!=`function`&&_(`Plugin ${o.pluginId} frontend does not export mount()`);return}let t=e.mount(s.current,b);c.current=typeof t==`function`?t:null}).catch(e=>{if(!i){let n=kd(e,`Plugin frontend unavailable`);_(t?`${t}; ${n}`:n)}}),()=>{i=!0;let e=x();e&&(l.current=e),S()}},[o.pluginId,i,d,m,y,b,e,_]),(0,R.jsxs)(`div`,{className:`plugin-host-page`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:m?.name||o.pluginName||`Plugin`}),(0,R.jsx)(`h2`,{children:o.label})]}),(0,R.jsx)(z,{type:`button`,onClick:()=>f(e=>e+1),disabled:h,children:h?`Loading`:`Reload`})]}),g?(0,R.jsx)(pe,{message:g}):null,(0,R.jsx)(V,{className:`plugin-host-panel`,children:(0,R.jsx)(`div`,{ref:s,className:`plugin-host-container`})})]})}function jd(e){return M(`/settings/api-keys/generate`,e)}function Md(e){return`'${String(e||``).replaceAll(`'`,`'"'"'`)}'`}function Nd(e){return String(e.id||``)}function Pd(e){return String(e.key_hint||e.hint||`-`)}function Fd(){let{authUser:e,authRole:t}=U(),[n,r]=(0,v.useState)(`single`),[i,a]=(0,v.useState)(`./logs`),[o,s]=(0,v.useState)(`http://<controller-ip>:9137`),[c,l]=(0,v.useState)(``),[u,d]=(0,v.useState)(``),[f,p]=(0,v.useState)(``),[m,h]=(0,v.useState)(`local-agent`),[g,_]=(0,v.useState)(`http://127.0.0.1:9137`),[y,b]=(0,v.useState)(`config`),[x,S]=(0,v.useState)(`llm`),[C,w]=(0,v.useState)(32),[T,E]=(0,v.useState)(1),[D,O]=(0,v.useState)(`controller`),[k,A]=(0,v.useState)(null),[ee,j]=(0,v.useState)([]),[M,te]=(0,v.useState)(``),[N,P]=(0,v.useState)(`operator`),[F,ne]=(0,v.useState)(null),[re,ie]=(0,v.useState)(``),[I,se]=(0,v.useState)(``),ce={config:`Config Helper`,"api-keys":`Admin Keys`,outputs:`Generated Files`},le=(0,v.useMemo)(()=>{let e=[`mode: ${n}`,`log_dir: ${JSON.stringify(i||`./logs`)}`,`models: {}`];return n===`controller`&&e.push(`nodes:`,`  ${m||`local-agent`}:`,`    url: ${JSON.stringify(g||`http://127.0.0.1:9000`)}`,`    api_key: ${JSON.stringify(f||`CHANGE_ME_AGENT_API_KEY`)}`,`    verify_tls: true`),n===`agent`&&(e.push(`controller_url: ${JSON.stringify(o||`http://127.0.0.1:9137`)}`,`controller_registration_key_outbound: ${JSON.stringify(u||`CHANGE_ME_REGISTRATION_KEY`)}`),c&&e.push(`controller_api_key: ${JSON.stringify(c)}`)),n===`single`&&c&&e.push(`api_key: ${JSON.stringify(c)}`),`${e.join(`
`)}\n`},[f,m,g,c,o,i,n,u]),ue=(0,v.useMemo)(()=>{let e=[`export LLAMA_PACK_CONFIG=config.yaml`,`export LLAMA_PACK_MODE=${n}`];return n===`agent`?(e.push(`export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND=${Md(u||`CHANGE_ME_REGISTRATION_KEY`)}`),e.push(`export LLAMA_PACK_CONTROLLER_URL=${Md(o||`http://127.0.0.1:9137`)}`),c&&e.push(`export LLAMA_PACK_CONTROLLER_API_KEY=${Md(c)}`)):n===`controller`?e.push(`export LLAMA_PACK_AGENT_API_KEY=${Md(f||`CHANGE_ME_AGENT_API_KEY`)}`):c&&e.push(`export LLAMA_PACK_API_KEY=${Md(c)}`),`${e.join(`
`)}\n`},[f,c,o,n,u]);async function de(){if(t!==`admin`){ie(`Admin role required.`),j([]);return}ie(``);let e=await ae();j(Array.isArray(e)?e:e.keys||[])}async function me(){if(t!==`admin`){ie(`Admin role required.`);return}if(!M.trim()){ie(`Enter username for key.`);return}ie(``),ne(await L({username:M.trim(),role:N})),await de()}async function H(e){await oe(e),await de()}async function he(){ie(``),A(await jd({prefix:x,token_bytes:C,count:T}))}function ge(){let e=k?.keys?.[0];if(!e){ie(`Generate keys first.`);return}D===`registration`?d(e):D===`agent`?p(e):l(e)}async function _e(e,t){await globalThis.navigator.clipboard?.writeText(t),se(`${e} copied`)}function ve(){Bc(`config.yaml`,le,`application/x-yaml`),se(`config.yaml downloaded`)}function ye(){Bc(`llama-pack.env.sh`,ue,`text/x-shellscript`),se(`env.sh downloaded`)}function be(){return(0,R.jsxs)(`div`,{className:`modal-actions settings-utilities`,children:[(0,R.jsx)(z,{type:`button`,onClick:()=>void _e(`Config YAML`,le),children:`Copy Config YAML`}),(0,R.jsx)(z,{type:`button`,onClick:ve,children:`Download config.yaml`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void _e(`Env exports`,ue),children:`Copy Env Exports`}),(0,R.jsx)(z,{type:`button`,onClick:ye,children:`Download env.sh`}),I?(0,R.jsx)(`span`,{className:`muted`,children:I}):null]})}return(0,R.jsxs)(`div`,{className:`settings-page-react`,children:[(0,R.jsxs)(`div`,{className:`page-heading`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`System`}),(0,R.jsx)(`h2`,{children:`System Settings`})]}),(0,R.jsx)(`span`,{className:`muted`,children:e?`${e} (${t||`operator`})`:`Not logged in`})]}),(0,R.jsx)(pe,{message:re}),(0,R.jsxs)(V,{className:`settings-panel`,children:[(0,R.jsx)(`div`,{className:`settings-tabs`,role:`tablist`,"aria-label":`Settings Sections`,children:[`config`,`api-keys`,`outputs`].map(e=>(0,R.jsx)(`button`,{type:`button`,className:`settings-tab ${y===e?`active`:``}`,"aria-selected":y===e,onClick:()=>b(e),children:ce[e]},e))}),y===`config`?(0,R.jsxs)(`div`,{className:`settings-pane active`,children:[(0,R.jsx)(`p`,{className:`muted settings-pane-note`,children:`Config Helper generates setup files and snippets. It does not modify the running service.`}),(0,R.jsxs)(`div`,{className:`controller-filters settings-filters`,children:[(0,R.jsx)(B,{label:`Log Directory`,children:(0,R.jsx)(`input`,{value:i,onChange:e=>a(e.target.value)})}),(0,R.jsx)(B,{label:`Mode`,children:(0,R.jsxs)(`select`,{value:n,onChange:e=>r(e.target.value),children:[(0,R.jsx)(`option`,{value:`single`,children:`single`}),(0,R.jsx)(`option`,{value:`controller`,children:`controller`}),(0,R.jsx)(`option`,{value:`agent`,children:`agent`})]})}),(0,R.jsx)(B,{label:`Controller URL`,children:(0,R.jsx)(`input`,{value:o,onChange:e=>s(e.target.value)})})]}),(0,R.jsxs)(`div`,{className:`controller-filters settings-filters`,children:[(0,R.jsx)(B,{label:`Controller API Key (Optional)`,children:(0,R.jsx)(`input`,{value:c,onChange:e=>l(e.target.value),type:`password`})}),(0,R.jsx)(B,{label:`Registration Key (Agent)`,children:(0,R.jsx)(`input`,{value:u,onChange:e=>d(e.target.value),type:`password`})}),(0,R.jsx)(B,{label:`Agent API Key (Controller Nodes)`,children:(0,R.jsx)(`input`,{value:f,onChange:e=>p(e.target.value),type:`password`})})]}),(0,R.jsxs)(`div`,{className:`controller-filters settings-filters`,children:[(0,R.jsx)(B,{label:`Agent Name`,children:(0,R.jsx)(`input`,{value:m,onChange:e=>h(e.target.value)})}),(0,R.jsx)(B,{label:`Agent URL`,children:(0,R.jsx)(`input`,{value:g,onChange:e=>_(e.target.value)})}),(0,R.jsx)(`button`,{className:`primary`,type:`button`,children:`Update Preview`})]})]}):null,y===`api-keys`?(0,R.jsxs)(`div`,{className:`settings-pane active`,children:[(0,R.jsx)(`p`,{className:`muted settings-pane-note`,children:`Admin Keys manage operator access to this console. Gateway app keys live under Gateway, App Keys.`}),(0,R.jsxs)(`div`,{className:`controller-filters settings-filters`,children:[(0,R.jsx)(B,{label:`Prefix`,children:(0,R.jsx)(`input`,{value:x,onChange:e=>S(e.target.value)})}),(0,R.jsx)(B,{label:`Random Bytes`,children:(0,R.jsx)(`input`,{type:`number`,min:16,max:128,value:C,onChange:e=>w(Number(e.target.value))})}),(0,R.jsx)(B,{label:`Count`,children:(0,R.jsx)(`input`,{type:`number`,min:1,max:20,value:T,onChange:e=>E(Number(e.target.value))})}),(0,R.jsx)(B,{label:`Apply To`,children:(0,R.jsxs)(`select`,{value:D,onChange:e=>O(e.target.value),children:[(0,R.jsx)(`option`,{value:`controller`,children:`Controller API Key`}),(0,R.jsx)(`option`,{value:`registration`,children:`Registration Key (Agent)`}),(0,R.jsx)(`option`,{value:`agent`,children:`Agent API Key`})]})}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>void he(),children:`Generate with Script`}),(0,R.jsx)(`button`,{type:`button`,onClick:ge,children:`Apply First Key`})]}),(0,R.jsx)(`pre`,{className:`detail-json`,children:k?JSON.stringify(k,null,2):`No generated keys yet.`}),(0,R.jsxs)(`div`,{className:`controller-filters settings-filters`,children:[(0,R.jsx)(B,{label:`Key username`,children:(0,R.jsx)(`input`,{value:M,onChange:e=>te(e.target.value)})}),(0,R.jsx)(B,{label:`Key role`,children:(0,R.jsxs)(`select`,{value:N,onChange:e=>P(e.target.value),children:[(0,R.jsx)(`option`,{value:`operator`,children:`operator`}),(0,R.jsx)(`option`,{value:`admin`,children:`admin`}),(0,R.jsx)(`option`,{value:`viewer`,children:`viewer`})]})}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>void me(),children:`Create Auth Key`}),(0,R.jsx)(`button`,{type:`button`,onClick:()=>void de(),children:`Refresh Auth Keys`})]}),(0,R.jsx)(`pre`,{className:`detail-json compact-json`,children:F?JSON.stringify(F,null,2):`No key created yet.`}),(0,R.jsx)(fe,{rows:ee,emptyMessage:t===`admin`?`No keys found.`:`Admin role required.`,getRowKey:(e,t)=>Nd(e)||String(t),columns:[{key:`username`,header:`Username`,render:e=>String(e.username||`-`)},{key:`role`,header:`Role`,render:e=>String(e.role||`-`)},{key:`hint`,header:`Hint`,render:Pd},{key:`revoked`,header:`Revoked`,render:e=>String(!!e.revoked)},{key:`created`,header:`Created`,render:e=>String(e.created_at||`-`)},{key:`action`,header:`Action`,render:e=>{let t=Nd(e);return(0,R.jsx)(`button`,{type:`button`,"aria-label":`Revoke ${t}`,disabled:!t||!!e.revoked,onClick:()=>void H(t),children:`Revoke`})}}]})]}):null,y===`outputs`?(0,R.jsxs)(`div`,{className:`settings-pane active`,children:[(0,R.jsx)(`p`,{className:`muted settings-pane-note`,children:`Generated Files are copyable outputs from the helper fields; downloading them does not change server config.`}),be(),(0,R.jsx)(`h3`,{children:`Config YAML`}),(0,R.jsx)(`pre`,{className:`detail-json tall-json`,children:le}),(0,R.jsx)(`h3`,{children:`Env Exports`}),(0,R.jsx)(`pre`,{className:`detail-json`,children:ue})]}):null,y===`outputs`?null:(0,R.jsxs)(`div`,{className:`settings-output-preview`,children:[be(),(0,R.jsx)(`h3`,{children:`Config YAML`}),(0,R.jsx)(`pre`,{className:`detail-json tall-json`,children:le}),(0,R.jsx)(`h3`,{children:`Env Exports`}),(0,R.jsx)(`pre`,{className:`detail-json`,children:ue})]})]})]})}function Id(e){let t=e.node||e.node_name;return t?`node:${t}`:`auto`}function Ld(e){let t=W(e),n=Id(e);return n.startsWith(`node:`)?`${t} on ${n.slice(5)}`:t}function Rd(e){return(Array.isArray(e)?e:[]).flatMap(e=>{let t=String(e.name||``),n=e.reachable,r=e.models;return!t||n===!1||!Array.isArray(r)?[]:r.map(e=>({...e,name:W(e),node:t}))}).filter(e=>W(e))}function zd(e){return Array.isArray(e)?e:e?.sessions||[]}function Bd(e){let t=e?.families;return{families:Array.isArray(t)?t:[]}}function Vd(e,t){return e.families.find(e=>e.family===t)?.profiles[0]?.profile||``}function Hd(e){return e.name||[e.model,e.updated_at].filter(Boolean).join(` - `)||e.id||`Untitled session`}function Ud(e){let t=e;return t?{node:typeof t.node==`string`?t.node:``,model:typeof t.model==`string`?t.model:``,reason:typeof t.reason==`string`?t.reason:``}:{}}async function Wd(e){if(!e.ok)throw Error(`${e.status} ${e.statusText}: ${await e.text()}`)}function Gd(){let[e,t]=(0,v.useState)(!1),[n,r]=(0,v.useState)(``),[i,a]=(0,v.useState)([]),[o,s]=(0,v.useState)({families:[]}),[c,l]=(0,v.useState)(``),[u,d]=(0,v.useState)(``),[f,p]=(0,v.useState)([]),[m,h]=(0,v.useState)(``),[g,_]=(0,v.useState)(`auto`),[y,b]=(0,v.useState)(`coding`),[x,S]=(0,v.useState)(``),[C,w]=(0,v.useState)(``),[T,E]=(0,v.useState)([]),[D,O]=(0,v.useState)(`Loading test chat`),[k,A]=(0,v.useState)(``),[ee,j]=(0,v.useState)(!1),[M,te]=(0,v.useState)(``);async function N(e,t={}){let n={Accept:`application/json`,...t.body?{"Content-Type":`application/json`}:{},...t.headers||{}},r=await fetch(e,{...t,credentials:`same-origin`,headers:n});return await Wd(r),r.json()}async function P(){let e=async e=>{let t=await fetch(e,{credentials:`same-origin`,headers:{Accept:`application/json`}});return await Wd(t),t.json()},t=Vc(await e(`/lm-api/v1/models`));t.length||(t=Rd(await e(`/lm-api/v1/nodes/models`))),a(t),h(e=>e||W(t[0]||{})),_(e=>e===`auto`&&Id(t[0]||{})!==`auto`?Id(t[0]||{}):e);try{let t=Bd(await e(`/lm-api/v1/models/profiles`));s(t),l(e=>e||t.families[0]?.family||``),d(e=>e||t.families[0]?.profiles[0]?.profile||``)}catch{s({families:[]})}}async function F(){let e=await fetch(`/lm-api/v1/chat/sessions`,{credentials:`same-origin`,headers:{Accept:`application/json`}});await Wd(e),p(zd(await e.json()))}(0,v.useEffect)(()=>{let e=!0;async function n(){A(``);try{let n=await fetch(`/lm-api/v1/test-chat/bootstrap`,{credentials:`same-origin`,headers:{Accept:`application/json`}});await Wd(n);let i=await n.json();if(!e)return;if(!i.enabled){if(i.mode===`agent`&&i.controller_test_chat_url){te(i.controller_test_chat_url),O(`Controller mode required`);return}O(`Test chat API key is not configured`),A(`Set LLAMA_PACK_TEST_CHAT_API_KEY and restart the server.`);return}t(!0),r(i.key_hint||``),O(`Ready`),await P(),await F()}catch(t){if(!e)return;A(t instanceof Error?t.message:`Failed to load test chat`),O(`Unavailable`)}}return n(),()=>{e=!1}},[]);async function ne(){let e=await N(`/lm-api/v1/threads`,{method:`POST`,body:JSON.stringify({title:null,default_model:m||null,metadata:{app:`test-chat`,purpose:`chat`,priority:`medium`,request_type:y}})}),t=String(e.id||``);return S(t),t}async function re(t){t.preventDefault();let n=C.trim();if(!n||ee||!e)return;A(``),j(!0),O(`Routing through controller`);let r={role:`user`,content:n},i={role:`assistant`,content:``,reasoningContent:``,pending:!0,reasoningCollapsed:!1};E(e=>[...e,r,i]),w(``);try{let e=x||await ne(),t=await fetch(`/lm-api/v1/threads/${encodeURIComponent(e)}/messages/stream`,{method:`POST`,credentials:`same-origin`,headers:{"Content-Type":`application/json`,Accept:`text/event-stream`},body:JSON.stringify({role:`user`,content:n,model:m||null,model_family:c||void 0,context_profile:u||void 0,target:g,metadata:{app:`test-chat`,purpose:`chat`,priority:`medium`,request_type:y}})});if(await Wd(t),!t.body)throw Error(`Response did not include a readable stream`);await Fo(t.body.getReader(),{onRoute(e){let t=Ud(e.route);E(e=>e.map(e=>e.pending?{...e,routeMeta:t}:e))},onDelta({content:e,reasoning:t}){E(n=>n.map(n=>{if(!n.pending)return n;let r=n.content+e,i=(n.reasoningContent||``)+t,a=!n.reasoningCollapsed&&r.length>0?!0:n.reasoningCollapsed;return{...n,content:r,reasoningContent:i,reasoningCollapsed:a}}))},onError(e){E(t=>t.map(t=>t.pending?{...t,role:`error`,content:e.error,pending:!1}:t))}}),E(e=>e.map(e=>{if(!e.pending)return e;let t=e.content||`(empty response)`;return{...e,content:t,pending:!1}})),O(e?`Thread ${e.slice(0,8)}`:`Ready`)}catch(e){let t=e instanceof Error?e.message:`Chat request failed`;A(t),E(e=>e.map(e=>e.pending?{role:`error`,content:t}:e)),O(`Error`)}finally{j(!1)}}async function ie(e){if(e)try{let t=await N(`/lm-api/v1/chat/sessions/${encodeURIComponent(e)}`);E(t.messages||[]),t.model&&h(t.model),_(t.target_selector||`auto`),O(`Session loaded`)}catch(e){A(e instanceof Error?e.message:`Failed to load session`)}}async function I(){if(!(!m||!T.length))try{await N(`/lm-api/v1/chat/sessions`,{method:`POST`,body:JSON.stringify({name:`Test Chat ${new Date().toLocaleString()}`,model:m,target:g,messages:T.filter(e=>e.role!==`error`).map(e=>{let t={role:e.role,content:e.content};return e.reasoningContent&&(t.reasoning_content=e.reasoningContent),t}),request_defaults:{chat_mode:`thread`,thread_id:x,thread_metadata:{app:`test-chat`,request_type:y},model_family:c||void 0,context_profile:u||void 0}})}),await F(),O(`Session saved`)}catch(e){A(e instanceof Error?e.message:`Failed to save session`)}}let ae=[`auto`,g,...i.map(Id)].filter((e,t,n)=>e&&n.indexOf(e)===t),L=o.families.filter(e=>e.family&&e.profiles.length),oe=L.find(e=>e.family===c);return(0,R.jsxs)(`div`,{className:`test-chat-shell`,children:[(0,R.jsxs)(`aside`,{className:`test-chat-sidebar`,children:[(0,R.jsxs)(`div`,{className:`test-chat-brand`,children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Key status`}),(0,R.jsx)(`strong`,{children:e?`Test chat session active`:`Test chat session unavailable`}),(0,R.jsx)(`small`,{children:n||`No scoped session`})]}),(0,R.jsx)(z,{type:`button`,onClick:()=>{S(``),E([]),O(`New routed chat`)},children:`New routed chat`}),(0,R.jsxs)(`section`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Sessions`}),(0,R.jsx)(`div`,{className:`test-chat-session-list`,children:f.length?f.map(e=>(0,R.jsxs)(`button`,{type:`button`,"aria-label":Hd(e),onClick:()=>void ie(e.id),children:[(0,R.jsx)(`strong`,{children:Hd(e)}),(0,R.jsx)(`small`,{children:[e.model,e.updated_at].filter(Boolean).join(` - `)||e.id})]},e.id)):(0,R.jsx)(`p`,{children:`No saved sessions.`})})]}),(0,R.jsx)(`p`,{className:`test-chat-limit`,children:`Limited page: no admin nav, no settings, no node mutation. Only routed chat, session/thread reads, and session saves.`})]}),(0,R.jsxs)(`main`,{className:`test-chat-main`,children:[(0,R.jsxs)(`header`,{className:`test-chat-header`,children:[(0,R.jsxs)(`div`,{children:[(0,R.jsx)(`span`,{className:`eyebrow`,children:`Route controls`}),(0,R.jsxs)(`div`,{className:`test-chat-controls`,children:[(0,R.jsx)(B,{label:`Model`,children:(0,R.jsx)(`select`,{value:m,onChange:e=>{let t=i.find(t=>W(t)===e.target.value);h(e.target.value),t&&_(Id(t))},children:i.map(e=>(0,R.jsx)(`option`,{value:W(e),children:Ld(e)},`${W(e)}-${Id(e)}`))})}),(0,R.jsx)(B,{label:`Target`,children:(0,R.jsx)(`select`,{value:g,onChange:e=>_(e.target.value),children:ae.map(e=>(0,R.jsx)(`option`,{value:e,children:e},e))})}),L.length?(0,R.jsxs)(R.Fragment,{children:[(0,R.jsx)(B,{label:`Model Family`,children:(0,R.jsx)(`select`,{value:c,onChange:e=>{let t=e.target.value;l(t),d(Vd(o,t))},children:L.map(e=>(0,R.jsx)(`option`,{value:e.family,children:e.family},e.family))})}),(0,R.jsx)(B,{label:`Context Profile`,children:(0,R.jsx)(`select`,{value:u,onChange:e=>d(e.target.value),children:(oe?.profiles||[]).map(e=>(0,R.jsx)(`option`,{value:e.profile,children:e.label||e.profile},e.profile))})})]}):null,(0,R.jsx)(B,{label:`Request type`,children:(0,R.jsxs)(`select`,{value:y,onChange:e=>b(e.target.value),children:[(0,R.jsx)(`option`,{value:`coding`,children:`coding`}),(0,R.jsx)(`option`,{value:`general`,children:`general`}),(0,R.jsx)(`option`,{value:`research`,children:`research`})]})})]})]}),(0,R.jsx)(H,{tone:ee?`warning`:k?`danger`:`success`,children:D})]}),(0,R.jsx)(pe,{message:k}),(0,R.jsx)(`section`,{className:`test-chat-transcript`,"aria-live":`polite`,children:M?(0,R.jsxs)(`div`,{className:`test-chat-controller-launcher`,children:[(0,R.jsx)(`h2`,{children:`Controller mode required`}),(0,R.jsx)(`p`,{children:`This routed chat test page runs on the controller because routing, sessions, and thread events are controller-owned.`}),(0,R.jsx)(`a`,{className:`btn btn-ghost`,href:M,children:`Open controller test chat`})]}):T.length?T.map((e,t)=>(0,R.jsxs)(`article`,{className:`test-chat-bubble test-chat-bubble-${e.role}${e.pending?` test-chat-bubble-pending`:``}`,children:[e.routeMeta?(0,R.jsxs)(`div`,{className:`test-chat-route-tokens`,children:[e.routeMeta.node?(0,R.jsxs)(`code`,{children:[`agent: `,e.routeMeta.node]}):null,e.routeMeta.model?(0,R.jsxs)(`code`,{children:[`model: `,e.routeMeta.model]}):null,e.routeMeta.reason?(0,R.jsxs)(`code`,{children:[`reason: `,e.routeMeta.reason]}):null]}):null,e.reasoningContent?(0,R.jsxs)(`details`,{className:`test-chat-reasoning`,open:!e.reasoningCollapsed,children:[(0,R.jsx)(`summary`,{children:(e.pending&&e.content,`Reasoning`)}),(0,R.jsx)(`pre`,{children:e.reasoningContent})]}):null,(0,R.jsx)(`p`,{children:e.content||(e.pending?`Generating answer...`:`(empty response)`)})]},`${e.role}-${t}`)):(0,R.jsx)(`p`,{className:`empty`,children:`Send a prompt to verify controller routing and agent selection.`})}),(0,R.jsxs)(`form`,{className:`test-chat-composer`,onSubmit:re,children:[(0,R.jsx)(B,{label:`Prompt`,children:(0,R.jsx)(`textarea`,{value:C,onChange:e=>w(e.target.value),rows:4})}),(0,R.jsxs)(`div`,{className:`modal-actions`,children:[(0,R.jsx)(z,{type:`submit`,disabled:!C.trim()||ee||!e,children:`Send`}),(0,R.jsx)(z,{type:`button`,onClick:()=>void I(),disabled:!T.length||ee,children:`Save session`})]})]})]})]})}function Kd(e,t){let n=t||{};return(e[e.length-1]===``?[...e,``]:e).join((n.padRight?` `:``)+`,`+(n.padLeft===!1?``:` `)).trim()}var qd=/^[$_\p{ID_Start}][$_\u{200C}\u{200D}\p{ID_Continue}]*$/u,Jd=/^[$_\p{ID_Start}][-$_\u{200C}\u{200D}\p{ID_Continue}]*$/u,Yd={};function Xd(e,t){return((t||Yd).jsx?Jd:qd).test(e)}var Zd=/[ \t\n\f\r]/g;function Qd(e){return typeof e==`object`?e.type===`text`?$d(e.value):!1:$d(e)}function $d(e){return e.replace(Zd,``)===``}var ef=class{constructor(e,t,n){this.normal=t,this.property=e,n&&(this.space=n)}};ef.prototype.normal={},ef.prototype.property={},ef.prototype.space=void 0;function tf(e,t){let n={},r={};for(let t of e)Object.assign(n,t.property),Object.assign(r,t.normal);return new ef(n,r,t)}function nf(e){return e.toLowerCase()}var rf=class{constructor(e,t){this.attribute=t,this.property=e}};rf.prototype.attribute=``,rf.prototype.booleanish=!1,rf.prototype.boolean=!1,rf.prototype.commaOrSpaceSeparated=!1,rf.prototype.commaSeparated=!1,rf.prototype.defined=!1,rf.prototype.mustUseProperty=!1,rf.prototype.number=!1,rf.prototype.overloadedBoolean=!1,rf.prototype.property=``,rf.prototype.spaceSeparated=!1,rf.prototype.space=void 0;var af=s({boolean:()=>X,booleanish:()=>sf,commaOrSpaceSeparated:()=>df,commaSeparated:()=>uf,number:()=>Z,overloadedBoolean:()=>cf,spaceSeparated:()=>lf}),of=0,X=ff(),sf=ff(),cf=ff(),Z=ff(),lf=ff(),uf=ff(),df=ff();function ff(){return 2**++of}var pf=Object.keys(af),mf=class extends rf{constructor(e,t,n,r){let i=-1;if(super(e,t),hf(this,`space`,r),typeof n==`number`)for(;++i<pf.length;){let e=pf[i];hf(this,pf[i],(n&af[e])===af[e])}}};mf.prototype.defined=!0;function hf(e,t,n){n&&(e[t]=n)}function gf(e){let t={},n={};for(let[r,i]of Object.entries(e.properties)){let a=new mf(r,e.transform(e.attributes||{},r),i,e.space);e.mustUseProperty&&e.mustUseProperty.includes(r)&&(a.mustUseProperty=!0),t[r]=a,n[nf(r)]=r,n[nf(a.attribute)]=r}return new ef(t,n,e.space)}var _f=gf({properties:{ariaActiveDescendant:null,ariaAtomic:sf,ariaAutoComplete:null,ariaBusy:sf,ariaChecked:sf,ariaColCount:Z,ariaColIndex:Z,ariaColSpan:Z,ariaControls:lf,ariaCurrent:null,ariaDescribedBy:lf,ariaDetails:null,ariaDisabled:sf,ariaDropEffect:lf,ariaErrorMessage:null,ariaExpanded:sf,ariaFlowTo:lf,ariaGrabbed:sf,ariaHasPopup:null,ariaHidden:sf,ariaInvalid:null,ariaKeyShortcuts:null,ariaLabel:null,ariaLabelledBy:lf,ariaLevel:Z,ariaLive:null,ariaModal:sf,ariaMultiLine:sf,ariaMultiSelectable:sf,ariaOrientation:null,ariaOwns:lf,ariaPlaceholder:null,ariaPosInSet:Z,ariaPressed:sf,ariaReadOnly:sf,ariaRelevant:null,ariaRequired:sf,ariaRoleDescription:lf,ariaRowCount:Z,ariaRowIndex:Z,ariaRowSpan:Z,ariaSelected:sf,ariaSetSize:Z,ariaSort:null,ariaValueMax:Z,ariaValueMin:Z,ariaValueNow:Z,ariaValueText:null,role:null},transform(e,t){return t===`role`?t:`aria-`+t.slice(4).toLowerCase()}});function vf(e,t){return t in e?e[t]:t}function yf(e,t){return vf(e,t.toLowerCase())}var bf=gf({attributes:{acceptcharset:`accept-charset`,classname:`class`,htmlfor:`for`,httpequiv:`http-equiv`},mustUseProperty:[`checked`,`multiple`,`muted`,`selected`],properties:{abbr:null,accept:uf,acceptCharset:lf,accessKey:lf,action:null,allow:null,allowFullScreen:X,allowPaymentRequest:X,allowUserMedia:X,alpha:X,alt:null,as:null,async:X,autoCapitalize:null,autoComplete:lf,autoFocus:X,autoPlay:X,blocking:lf,capture:null,charSet:null,checked:X,cite:null,className:lf,closedBy:null,colorSpace:null,cols:Z,colSpan:Z,command:null,commandFor:null,content:null,contentEditable:sf,controls:X,controlsList:lf,coords:Z|uf,crossOrigin:null,data:null,dateTime:null,decoding:null,default:X,defer:X,dir:null,dirName:null,disabled:X,download:cf,draggable:sf,encType:null,enterKeyHint:null,fetchPriority:null,form:null,formAction:null,formEncType:null,formMethod:null,formNoValidate:X,formTarget:null,headers:lf,height:Z,hidden:cf,high:Z,href:null,hrefLang:null,htmlFor:lf,httpEquiv:lf,id:null,imageSizes:null,imageSrcSet:null,inert:X,inputMode:null,integrity:null,is:null,isMap:X,itemId:null,itemProp:lf,itemRef:lf,itemScope:X,itemType:lf,kind:null,label:null,lang:null,language:null,list:null,loading:null,loop:X,low:Z,manifest:null,max:null,maxLength:Z,media:null,method:null,min:null,minLength:Z,multiple:X,muted:X,name:null,nonce:null,noModule:X,noValidate:X,onAbort:null,onAfterPrint:null,onAuxClick:null,onBeforeMatch:null,onBeforePrint:null,onBeforeToggle:null,onBeforeUnload:null,onBlur:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onContextLost:null,onContextMenu:null,onContextRestored:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnded:null,onError:null,onFocus:null,onFormData:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLanguageChange:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadEnd:null,onLoadStart:null,onMessage:null,onMessageError:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRejectionHandled:null,onReset:null,onResize:null,onScroll:null,onScrollEnd:null,onSecurityPolicyViolation:null,onSeeked:null,onSeeking:null,onSelect:null,onSlotChange:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnhandledRejection:null,onUnload:null,onVolumeChange:null,onWaiting:null,onWheel:null,open:X,optimum:Z,pattern:null,ping:lf,placeholder:null,playsInline:X,popover:null,popoverTarget:null,popoverTargetAction:null,poster:null,preload:null,readOnly:X,referrerPolicy:null,rel:lf,required:X,reversed:X,rows:Z,rowSpan:Z,sandbox:lf,scope:null,scoped:X,seamless:X,selected:X,shadowRootClonable:X,shadowRootCustomElementRegistry:X,shadowRootDelegatesFocus:X,shadowRootMode:null,shadowRootSerializable:X,shape:null,size:Z,sizes:null,slot:null,span:Z,spellCheck:sf,src:null,srcDoc:null,srcLang:null,srcSet:null,start:Z,step:null,style:null,tabIndex:Z,target:null,title:null,translate:null,type:null,typeMustMatch:X,useMap:null,value:sf,width:Z,wrap:null,writingSuggestions:null,align:null,aLink:null,archive:lf,axis:null,background:null,bgColor:null,border:Z,borderColor:null,bottomMargin:Z,cellPadding:null,cellSpacing:null,char:null,charOff:null,classId:null,clear:null,code:null,codeBase:null,codeType:null,color:null,compact:X,declare:X,event:null,face:null,frame:null,frameBorder:null,hSpace:Z,leftMargin:Z,link:null,longDesc:null,lowSrc:null,marginHeight:Z,marginWidth:Z,noResize:X,noHref:X,noShade:X,noWrap:X,object:null,profile:null,prompt:null,rev:null,rightMargin:Z,rules:null,scheme:null,scrolling:sf,standby:null,summary:null,text:null,topMargin:Z,valueType:null,version:null,vAlign:null,vLink:null,vSpace:Z,allowTransparency:null,autoCorrect:null,autoSave:null,credentialless:X,disablePictureInPicture:X,disableRemotePlayback:X,exportParts:uf,part:lf,prefix:null,property:null,results:Z,security:null,unselectable:null},space:`html`,transform:yf}),xf=gf({attributes:{accentHeight:`accent-height`,alignmentBaseline:`alignment-baseline`,arabicForm:`arabic-form`,baselineShift:`baseline-shift`,capHeight:`cap-height`,className:`class`,clipPath:`clip-path`,clipRule:`clip-rule`,colorInterpolation:`color-interpolation`,colorInterpolationFilters:`color-interpolation-filters`,colorProfile:`color-profile`,colorRendering:`color-rendering`,crossOrigin:`crossorigin`,dataType:`datatype`,dominantBaseline:`dominant-baseline`,enableBackground:`enable-background`,fillOpacity:`fill-opacity`,fillRule:`fill-rule`,floodColor:`flood-color`,floodOpacity:`flood-opacity`,fontFamily:`font-family`,fontSize:`font-size`,fontSizeAdjust:`font-size-adjust`,fontStretch:`font-stretch`,fontStyle:`font-style`,fontVariant:`font-variant`,fontWeight:`font-weight`,glyphName:`glyph-name`,glyphOrientationHorizontal:`glyph-orientation-horizontal`,glyphOrientationVertical:`glyph-orientation-vertical`,hrefLang:`hreflang`,horizAdvX:`horiz-adv-x`,horizOriginX:`horiz-origin-x`,horizOriginY:`horiz-origin-y`,imageRendering:`image-rendering`,letterSpacing:`letter-spacing`,lightingColor:`lighting-color`,markerEnd:`marker-end`,markerMid:`marker-mid`,markerStart:`marker-start`,maskType:`mask-type`,navDown:`nav-down`,navDownLeft:`nav-down-left`,navDownRight:`nav-down-right`,navLeft:`nav-left`,navNext:`nav-next`,navPrev:`nav-prev`,navRight:`nav-right`,navUp:`nav-up`,navUpLeft:`nav-up-left`,navUpRight:`nav-up-right`,onAbort:`onabort`,onActivate:`onactivate`,onAfterPrint:`onafterprint`,onBeforePrint:`onbeforeprint`,onBegin:`onbegin`,onCancel:`oncancel`,onCanPlay:`oncanplay`,onCanPlayThrough:`oncanplaythrough`,onChange:`onchange`,onClick:`onclick`,onClose:`onclose`,onCopy:`oncopy`,onCueChange:`oncuechange`,onCut:`oncut`,onDblClick:`ondblclick`,onDrag:`ondrag`,onDragEnd:`ondragend`,onDragEnter:`ondragenter`,onDragExit:`ondragexit`,onDragLeave:`ondragleave`,onDragOver:`ondragover`,onDragStart:`ondragstart`,onDrop:`ondrop`,onDurationChange:`ondurationchange`,onEmptied:`onemptied`,onEnd:`onend`,onEnded:`onended`,onError:`onerror`,onFocus:`onfocus`,onFocusIn:`onfocusin`,onFocusOut:`onfocusout`,onHashChange:`onhashchange`,onInput:`oninput`,onInvalid:`oninvalid`,onKeyDown:`onkeydown`,onKeyPress:`onkeypress`,onKeyUp:`onkeyup`,onLoad:`onload`,onLoadedData:`onloadeddata`,onLoadedMetadata:`onloadedmetadata`,onLoadStart:`onloadstart`,onMessage:`onmessage`,onMouseDown:`onmousedown`,onMouseEnter:`onmouseenter`,onMouseLeave:`onmouseleave`,onMouseMove:`onmousemove`,onMouseOut:`onmouseout`,onMouseOver:`onmouseover`,onMouseUp:`onmouseup`,onMouseWheel:`onmousewheel`,onOffline:`onoffline`,onOnline:`ononline`,onPageHide:`onpagehide`,onPageShow:`onpageshow`,onPaste:`onpaste`,onPause:`onpause`,onPlay:`onplay`,onPlaying:`onplaying`,onPopState:`onpopstate`,onProgress:`onprogress`,onRateChange:`onratechange`,onRepeat:`onrepeat`,onReset:`onreset`,onResize:`onresize`,onScroll:`onscroll`,onSeeked:`onseeked`,onSeeking:`onseeking`,onSelect:`onselect`,onShow:`onshow`,onStalled:`onstalled`,onStorage:`onstorage`,onSubmit:`onsubmit`,onSuspend:`onsuspend`,onTimeUpdate:`ontimeupdate`,onToggle:`ontoggle`,onUnload:`onunload`,onVolumeChange:`onvolumechange`,onWaiting:`onwaiting`,onZoom:`onzoom`,overlinePosition:`overline-position`,overlineThickness:`overline-thickness`,paintOrder:`paint-order`,panose1:`panose-1`,pointerEvents:`pointer-events`,referrerPolicy:`referrerpolicy`,renderingIntent:`rendering-intent`,shapeRendering:`shape-rendering`,stopColor:`stop-color`,stopOpacity:`stop-opacity`,strikethroughPosition:`strikethrough-position`,strikethroughThickness:`strikethrough-thickness`,strokeDashArray:`stroke-dasharray`,strokeDashOffset:`stroke-dashoffset`,strokeLineCap:`stroke-linecap`,strokeLineJoin:`stroke-linejoin`,strokeMiterLimit:`stroke-miterlimit`,strokeOpacity:`stroke-opacity`,strokeWidth:`stroke-width`,tabIndex:`tabindex`,textAnchor:`text-anchor`,textDecoration:`text-decoration`,textRendering:`text-rendering`,transformOrigin:`transform-origin`,typeOf:`typeof`,underlinePosition:`underline-position`,underlineThickness:`underline-thickness`,unicodeBidi:`unicode-bidi`,unicodeRange:`unicode-range`,unitsPerEm:`units-per-em`,vAlphabetic:`v-alphabetic`,vHanging:`v-hanging`,vIdeographic:`v-ideographic`,vMathematical:`v-mathematical`,vectorEffect:`vector-effect`,vertAdvY:`vert-adv-y`,vertOriginX:`vert-origin-x`,vertOriginY:`vert-origin-y`,wordSpacing:`word-spacing`,writingMode:`writing-mode`,xHeight:`x-height`,playbackOrder:`playbackorder`,timelineBegin:`timelinebegin`},properties:{about:df,accentHeight:Z,accumulate:null,additive:null,alignmentBaseline:null,alphabetic:Z,amplitude:Z,arabicForm:null,ascent:Z,attributeName:null,attributeType:null,azimuth:Z,bandwidth:null,baselineShift:null,baseFrequency:null,baseProfile:null,bbox:null,begin:null,bias:Z,by:null,calcMode:null,capHeight:Z,className:lf,clip:null,clipPath:null,clipPathUnits:null,clipRule:null,color:null,colorInterpolation:null,colorInterpolationFilters:null,colorProfile:null,colorRendering:null,content:null,contentScriptType:null,contentStyleType:null,crossOrigin:null,cursor:null,cx:null,cy:null,d:null,dataType:null,defaultAction:null,descent:Z,diffuseConstant:Z,direction:null,display:null,dur:null,divisor:Z,dominantBaseline:null,download:X,dx:null,dy:null,edgeMode:null,editable:null,elevation:Z,enableBackground:null,end:null,event:null,exponent:Z,externalResourcesRequired:null,fill:null,fillOpacity:Z,fillRule:null,filter:null,filterRes:null,filterUnits:null,floodColor:null,floodOpacity:null,focusable:null,focusHighlight:null,fontFamily:null,fontSize:null,fontSizeAdjust:null,fontStretch:null,fontStyle:null,fontVariant:null,fontWeight:null,format:null,fr:null,from:null,fx:null,fy:null,g1:uf,g2:uf,glyphName:uf,glyphOrientationHorizontal:null,glyphOrientationVertical:null,glyphRef:null,gradientTransform:null,gradientUnits:null,handler:null,hanging:Z,hatchContentUnits:null,hatchUnits:null,height:null,href:null,hrefLang:null,horizAdvX:Z,horizOriginX:Z,horizOriginY:Z,id:null,ideographic:Z,imageRendering:null,initialVisibility:null,in:null,in2:null,intercept:Z,k:Z,k1:Z,k2:Z,k3:Z,k4:Z,kernelMatrix:df,kernelUnitLength:null,keyPoints:null,keySplines:null,keyTimes:null,kerning:null,lang:null,lengthAdjust:null,letterSpacing:null,lightingColor:null,limitingConeAngle:Z,local:null,markerEnd:null,markerMid:null,markerStart:null,markerHeight:null,markerUnits:null,markerWidth:null,mask:null,maskContentUnits:null,maskType:null,maskUnits:null,mathematical:null,max:null,media:null,mediaCharacterEncoding:null,mediaContentEncodings:null,mediaSize:Z,mediaTime:null,method:null,min:null,mode:null,name:null,navDown:null,navDownLeft:null,navDownRight:null,navLeft:null,navNext:null,navPrev:null,navRight:null,navUp:null,navUpLeft:null,navUpRight:null,numOctaves:null,observer:null,offset:null,onAbort:null,onActivate:null,onAfterPrint:null,onBeforePrint:null,onBegin:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnd:null,onEnded:null,onError:null,onFocus:null,onFocusIn:null,onFocusOut:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadStart:null,onMessage:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onMouseWheel:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRepeat:null,onReset:null,onResize:null,onScroll:null,onSeeked:null,onSeeking:null,onSelect:null,onShow:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnload:null,onVolumeChange:null,onWaiting:null,onZoom:null,opacity:null,operator:null,order:null,orient:null,orientation:null,origin:null,overflow:null,overlay:null,overlinePosition:Z,overlineThickness:Z,paintOrder:null,panose1:null,path:null,pathLength:Z,patternContentUnits:null,patternTransform:null,patternUnits:null,phase:null,ping:lf,pitch:null,playbackOrder:null,pointerEvents:null,points:null,pointsAtX:Z,pointsAtY:Z,pointsAtZ:Z,preserveAlpha:null,preserveAspectRatio:null,primitiveUnits:null,propagate:null,property:df,r:null,radius:null,referrerPolicy:null,refX:null,refY:null,rel:df,rev:df,renderingIntent:null,repeatCount:null,repeatDur:null,requiredExtensions:df,requiredFeatures:df,requiredFonts:df,requiredFormats:df,resource:null,restart:null,result:null,rotate:null,rx:null,ry:null,scale:null,seed:null,shapeRendering:null,side:null,slope:null,snapshotTime:null,specularConstant:Z,specularExponent:Z,spreadMethod:null,spacing:null,startOffset:null,stdDeviation:null,stemh:null,stemv:null,stitchTiles:null,stopColor:null,stopOpacity:null,strikethroughPosition:Z,strikethroughThickness:Z,string:null,stroke:null,strokeDashArray:df,strokeDashOffset:null,strokeLineCap:null,strokeLineJoin:null,strokeMiterLimit:Z,strokeOpacity:Z,strokeWidth:null,style:null,surfaceScale:Z,syncBehavior:null,syncBehaviorDefault:null,syncMaster:null,syncTolerance:null,syncToleranceDefault:null,systemLanguage:df,tabIndex:Z,tableValues:null,target:null,targetX:Z,targetY:Z,textAnchor:null,textDecoration:null,textRendering:null,textLength:null,timelineBegin:null,title:null,transformBehavior:null,type:null,typeOf:df,to:null,transform:null,transformOrigin:null,u1:null,u2:null,underlinePosition:Z,underlineThickness:Z,unicode:null,unicodeBidi:null,unicodeRange:null,unitsPerEm:Z,values:null,vAlphabetic:Z,vMathematical:Z,vectorEffect:null,vHanging:Z,vIdeographic:Z,version:null,vertAdvY:Z,vertOriginX:Z,vertOriginY:Z,viewBox:null,viewTarget:null,visibility:null,width:null,widths:null,wordSpacing:null,writingMode:null,x:null,x1:null,x2:null,xChannelSelector:null,xHeight:Z,y:null,y1:null,y2:null,yChannelSelector:null,z:null,zoomAndPan:null},space:`svg`,transform:vf}),Sf=gf({properties:{xLinkActuate:null,xLinkArcRole:null,xLinkHref:null,xLinkRole:null,xLinkShow:null,xLinkTitle:null,xLinkType:null},space:`xlink`,transform(e,t){return`xlink:`+t.slice(5).toLowerCase()}}),Cf=gf({attributes:{xmlnsxlink:`xmlns:xlink`},properties:{xmlnsXLink:null,xmlns:null},space:`xmlns`,transform:yf}),wf=gf({properties:{xmlBase:null,xmlLang:null,xmlSpace:null},space:`xml`,transform(e,t){return`xml:`+t.slice(3).toLowerCase()}}),Tf={classId:`classID`,dataType:`datatype`,itemId:`itemID`,strokeDashArray:`strokeDasharray`,strokeDashOffset:`strokeDashoffset`,strokeLineCap:`strokeLinecap`,strokeLineJoin:`strokeLinejoin`,strokeMiterLimit:`strokeMiterlimit`,typeOf:`typeof`,xLinkActuate:`xlinkActuate`,xLinkArcRole:`xlinkArcrole`,xLinkHref:`xlinkHref`,xLinkRole:`xlinkRole`,xLinkShow:`xlinkShow`,xLinkTitle:`xlinkTitle`,xLinkType:`xlinkType`,xmlnsXLink:`xmlnsXlink`},Ef=/[A-Z]/g,Df=/-[a-z]/g,Of=/^data[-\w.:]+$/i;function kf(e,t){let n=nf(t),r=t,i=rf;if(n in e.normal)return e.property[e.normal[n]];if(n.length>4&&n.slice(0,4)===`data`&&Of.test(t)){if(t.charAt(4)===`-`){let e=t.slice(5).replace(Df,jf);r=`data`+e.charAt(0).toUpperCase()+e.slice(1)}else{let e=t.slice(4);if(!Df.test(e)){let n=e.replace(Ef,Af);n.charAt(0)!==`-`&&(n=`-`+n),t=`data`+n}}i=mf}return new i(r,t)}function Af(e){return`-`+e.toLowerCase()}function jf(e){return e.charAt(1).toUpperCase()}var Mf=tf([_f,bf,Sf,Cf,wf],`html`),Nf=tf([_f,xf,Sf,Cf,wf],`svg`);function Pf(e){return e.join(` `).trim()}var Ff=o(((e,t)=>{var n=/\/\*[^*]*\*+([^/*][^*]*\*+)*\//g,r=/\n/g,i=/^\s*/,a=/^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/,o=/^:\s*/,s=/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/,c=/^[;\s]*/,l=/^\s+|\s+$/g,u=`
`,d=`/`,f=`*`,p=``,m=`comment`,h=`declaration`;function g(e,t){if(typeof e!=`string`)throw TypeError(`First argument must be a string`);if(!e)return[];t||={};var l=1,g=1;function v(e){var t=e.match(r);t&&(l+=t.length);var n=e.lastIndexOf(u);g=~n?e.length-n:g+e.length}function y(){var e={line:l,column:g};return function(t){return t.position=new b(e),C(),t}}function b(e){this.start=e,this.end={line:l,column:g},this.source=t.source}b.prototype.content=e;function x(n){var r=Error(t.source+`:`+l+`:`+g+`: `+n);if(r.reason=n,r.filename=t.source,r.line=l,r.column=g,r.source=e,!t.silent)throw r}function S(t){var n=t.exec(e);if(n){var r=n[0];return v(r),e=e.slice(r.length),n}}function C(){S(i)}function w(e){var t;for(e||=[];t=T();)t!==!1&&e.push(t);return e}function T(){var t=y();if(!(d!=e.charAt(0)||f!=e.charAt(1))){for(var n=2;p!=e.charAt(n)&&(f!=e.charAt(n)||d!=e.charAt(n+1));)++n;if(n+=2,p===e.charAt(n-1))return x(`End of comment missing`);var r=e.slice(2,n-2);return g+=2,v(r),e=e.slice(n),g+=2,t({type:m,comment:r})}}function E(){var e=y(),t=S(a);if(t){if(T(),!S(o))return x(`property missing ':'`);var r=S(s),i=e({type:h,property:_(t[0].replace(n,p)),value:r?_(r[0].replace(n,p)):p});return S(c),i}}function D(){var e=[];w(e);for(var t;t=E();)t!==!1&&(e.push(t),w(e));return e}return C(),D()}function _(e){return e?e.replace(l,p):p}t.exports=g})),If=o((e=>{var t=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,`__esModule`,{value:!0}),e.default=r;var n=t(Ff());function r(e,t){let r=null;if(!e||typeof e!=`string`)return r;let i=(0,n.default)(e),a=typeof t==`function`;return i.forEach(e=>{if(e.type!==`declaration`)return;let{property:n,value:i}=e;a?t(n,i,e):i&&(r||={},r[n]=i)}),r}})),Lf=o((e=>{Object.defineProperty(e,`__esModule`,{value:!0}),e.camelCase=void 0;var t=/^--[a-zA-Z0-9_-]+$/,n=/-([a-z])/g,r=/^[^-]+$/,i=/^-(webkit|moz|ms|o|khtml)-/,a=/^-(ms)-/,o=function(e){return!e||r.test(e)||t.test(e)},s=function(e,t){return t.toUpperCase()},c=function(e,t){return`${t}-`};e.camelCase=function(e,t){return t===void 0&&(t={}),o(e)?e:(e=e.toLowerCase(),e=t.reactCompat?e.replace(a,c):e.replace(i,c),e.replace(n,s))}})),Rf=o(((e,t)=>{var n=(e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}})(If()),r=Lf();function i(e,t){var i={};return!e||typeof e!=`string`||(0,n.default)(e,function(e,n){e&&n&&(i[(0,r.camelCase)(e,t)]=n)}),i}i.default=i,t.exports=i})),zf=Vf(`end`),Bf=Vf(`start`);function Vf(e){return t;function t(t){let n=t&&t.position&&t.position[e]||{};if(typeof n.line==`number`&&n.line>0&&typeof n.column==`number`&&n.column>0)return{line:n.line,column:n.column,offset:typeof n.offset==`number`&&n.offset>-1?n.offset:void 0}}}function Hf(e){let t=Bf(e),n=zf(e);if(t&&n)return{start:t,end:n}}function Uf(e){return!e||typeof e!=`object`?``:`position`in e||`type`in e?Gf(e.position):`start`in e||`end`in e?Gf(e):`line`in e||`column`in e?Wf(e):``}function Wf(e){return Kf(e&&e.line)+`:`+Kf(e&&e.column)}function Gf(e){return Wf(e&&e.start)+`-`+Wf(e&&e.end)}function Kf(e){return e&&typeof e==`number`?e:1}var qf=class extends Error{constructor(e,t,n){super(),typeof t==`string`&&(n=t,t=void 0);let r=``,i={},a=!1;if(t&&(i=`line`in t&&`column`in t||`start`in t&&`end`in t?{place:t}:`type`in t?{ancestors:[t],place:t.position}:{...t}),typeof e==`string`?r=e:!i.cause&&e&&(a=!0,r=e.message,i.cause=e),!i.ruleId&&!i.source&&typeof n==`string`){let e=n.indexOf(`:`);e===-1?i.ruleId=n:(i.source=n.slice(0,e),i.ruleId=n.slice(e+1))}if(!i.place&&i.ancestors&&i.ancestors){let e=i.ancestors[i.ancestors.length-1];e&&(i.place=e.position)}let o=i.place&&`start`in i.place?i.place.start:i.place;this.ancestors=i.ancestors||void 0,this.cause=i.cause||void 0,this.column=o?o.column:void 0,this.fatal=void 0,this.file=``,this.message=r,this.line=o?o.line:void 0,this.name=Uf(i.place)||`1:1`,this.place=i.place||void 0,this.reason=this.message,this.ruleId=i.ruleId||void 0,this.source=i.source||void 0,this.stack=a&&i.cause&&typeof i.cause.stack==`string`?i.cause.stack:``,this.actual=void 0,this.expected=void 0,this.note=void 0,this.url=void 0}};qf.prototype.file=``,qf.prototype.name=``,qf.prototype.reason=``,qf.prototype.message=``,qf.prototype.stack=``,qf.prototype.column=void 0,qf.prototype.line=void 0,qf.prototype.ancestors=void 0,qf.prototype.cause=void 0,qf.prototype.fatal=void 0,qf.prototype.place=void 0,qf.prototype.ruleId=void 0,qf.prototype.source=void 0;var Jf=l(Rf(),1),Yf={}.hasOwnProperty,Xf=new Map,Zf=/[A-Z]/g,Qf=new Set([`table`,`tbody`,`thead`,`tfoot`,`tr`]),$f=new Set([`td`,`th`]),ep=`https://github.com/syntax-tree/hast-util-to-jsx-runtime`;function tp(e,t){if(!t||t.Fragment===void 0)throw TypeError("Expected `Fragment` in options");let n=t.filePath||void 0,r;if(t.development){if(typeof t.jsxDEV!=`function`)throw TypeError("Expected `jsxDEV` in options when `development: true`");r=fp(n,t.jsxDEV)}else{if(typeof t.jsx!=`function`)throw TypeError("Expected `jsx` in production options");if(typeof t.jsxs!=`function`)throw TypeError("Expected `jsxs` in production options");r=dp(n,t.jsx,t.jsxs)}let i={Fragment:t.Fragment,ancestors:[],components:t.components||{},create:r,elementAttributeNameCase:t.elementAttributeNameCase||`react`,evaluater:t.createEvaluater?t.createEvaluater():void 0,filePath:n,ignoreInvalidStyle:t.ignoreInvalidStyle||!1,passKeys:t.passKeys!==!1,passNode:t.passNode||!1,schema:t.space===`svg`?Nf:Mf,stylePropertyNameCase:t.stylePropertyNameCase||`dom`,tableCellAlignToStyle:t.tableCellAlignToStyle!==!1},a=np(i,e,void 0);return a&&typeof a!=`string`?a:i.create(e,i.Fragment,{children:a||void 0},void 0)}function np(e,t,n){if(t.type===`element`)return rp(e,t,n);if(t.type===`mdxFlowExpression`||t.type===`mdxTextExpression`)return ip(e,t);if(t.type===`mdxJsxFlowElement`||t.type===`mdxJsxTextElement`)return op(e,t,n);if(t.type===`mdxjsEsm`)return ap(e,t);if(t.type===`root`)return sp(e,t,n);if(t.type===`text`)return cp(e,t)}function rp(e,t,n){let r=e.schema,i=r;t.tagName.toLowerCase()===`svg`&&r.space===`html`&&(i=Nf,e.schema=i),e.ancestors.push(t);let a=vp(e,t.tagName,!1),o=pp(e,t),s=hp(e,t);return Qf.has(t.tagName)&&(s=s.filter(function(e){return typeof e==`string`?!Qd(e):!0})),lp(e,o,a,t),up(o,s),e.ancestors.pop(),e.schema=r,e.create(t,a,o,n)}function ip(e,t){if(t.data&&t.data.estree&&e.evaluater){let n=t.data.estree.body[0];return n.type,e.evaluater.evaluateExpression(n.expression)}yp(e,t.position)}function ap(e,t){if(t.data&&t.data.estree&&e.evaluater)return e.evaluater.evaluateProgram(t.data.estree);yp(e,t.position)}function op(e,t,n){let r=e.schema,i=r;t.name===`svg`&&r.space===`html`&&(i=Nf,e.schema=i),e.ancestors.push(t);let a=t.name===null?e.Fragment:vp(e,t.name,!0),o=mp(e,t),s=hp(e,t);return lp(e,o,a,t),up(o,s),e.ancestors.pop(),e.schema=r,e.create(t,a,o,n)}function sp(e,t,n){let r={};return up(r,hp(e,t)),e.create(t,e.Fragment,r,n)}function cp(e,t){return t.value}function lp(e,t,n,r){typeof n!=`string`&&n!==e.Fragment&&e.passNode&&(t.node=r)}function up(e,t){if(t.length>0){let n=t.length>1?t:t[0];n&&(e.children=n)}}function dp(e,t,n){return r;function r(e,r,i,a){let o=Array.isArray(i.children)?n:t;return a?o(r,i,a):o(r,i)}}function fp(e,t){return n;function n(n,r,i,a){let o=Array.isArray(i.children),s=Bf(n);return t(r,i,a,o,{columnNumber:s?s.column-1:void 0,fileName:e,lineNumber:s?s.line:void 0},void 0)}}function pp(e,t){let n={},r,i;for(i in t.properties)if(i!==`children`&&Yf.call(t.properties,i)){let a=gp(e,i,t.properties[i]);if(a){let[i,o]=a;e.tableCellAlignToStyle&&i===`align`&&typeof o==`string`&&$f.has(t.tagName)?r=o:n[i]=o}}if(r){let t=n.style||={};t[e.stylePropertyNameCase===`css`?`text-align`:`textAlign`]=r}return n}function mp(e,t){let n={};for(let r of t.attributes)if(r.type===`mdxJsxExpressionAttribute`)if(r.data&&r.data.estree&&e.evaluater){let t=r.data.estree.body[0];t.type;let i=t.expression;i.type;let a=i.properties[0];a.type,Object.assign(n,e.evaluater.evaluateExpression(a.argument))}else yp(e,t.position);else{let i=r.name,a;if(r.value&&typeof r.value==`object`)if(r.value.data&&r.value.data.estree&&e.evaluater){let t=r.value.data.estree.body[0];t.type,a=e.evaluater.evaluateExpression(t.expression)}else yp(e,t.position);else a=r.value===null?!0:r.value;n[i]=a}return n}function hp(e,t){let n=[],r=-1,i=e.passKeys?new Map:Xf;for(;++r<t.children.length;){let a=t.children[r],o;if(e.passKeys){let e=a.type===`element`?a.tagName:a.type===`mdxJsxFlowElement`||a.type===`mdxJsxTextElement`?a.name:void 0;if(e){let t=i.get(e)||0;o=e+`-`+t,i.set(e,t+1)}}let s=np(e,a,o);s!==void 0&&n.push(s)}return n}function gp(e,t,n){let r=kf(e.schema,t);if(!(n==null||typeof n==`number`&&Number.isNaN(n))){if(Array.isArray(n)&&(n=r.commaSeparated?Kd(n):Pf(n)),r.property===`style`){let t=typeof n==`object`?n:_p(e,String(n));return e.stylePropertyNameCase===`css`&&(t=bp(t)),[`style`,t]}return[e.elementAttributeNameCase===`react`&&r.space?Tf[r.property]||r.property:r.attribute,n]}}function _p(e,t){try{return(0,Jf.default)(t,{reactCompat:!0})}catch(t){if(e.ignoreInvalidStyle)return{};let n=t,r=new qf("Cannot parse `style` attribute",{ancestors:e.ancestors,cause:n,ruleId:`style`,source:`hast-util-to-jsx-runtime`});throw r.file=e.filePath||void 0,r.url=ep+`#cannot-parse-style-attribute`,r}}function vp(e,t,n){let r;if(!n)r={type:`Literal`,value:t};else if(t.includes(`.`)){let e=t.split(`.`),n=-1,i;for(;++n<e.length;){let t=Xd(e[n])?{type:`Identifier`,name:e[n]}:{type:`Literal`,value:e[n]};i=i?{type:`MemberExpression`,object:i,property:t,computed:!!(n&&t.type===`Literal`),optional:!1}:t}r=i}else r=Xd(t)&&!/^[a-z]/.test(t)?{type:`Identifier`,name:t}:{type:`Literal`,value:t};if(r.type===`Literal`){let t=r.value;return Yf.call(e.components,t)?e.components[t]:t}if(e.evaluater)return e.evaluater.evaluateExpression(r);yp(e)}function yp(e,t){let n=new qf("Cannot handle MDX estrees without `createEvaluater`",{ancestors:e.ancestors,place:t,ruleId:`mdx-estree`,source:`hast-util-to-jsx-runtime`});throw n.file=e.filePath||void 0,n.url=ep+`#cannot-handle-mdx-estrees-without-createevaluater`,n}function bp(e){let t={},n;for(n in e)Yf.call(e,n)&&(t[xp(n)]=e[n]);return t}function xp(e){let t=e.replace(Zf,Sp);return t.slice(0,3)===`ms-`&&(t=`-`+t),t}function Sp(e){return`-`+e.toLowerCase()}var Cp={action:[`form`],cite:[`blockquote`,`del`,`ins`,`q`],data:[`object`],formAction:[`button`,`input`],href:[`a`,`area`,`base`,`link`],icon:[`menuitem`],itemId:null,manifest:[`html`],ping:[`a`,`area`],poster:[`video`],src:[`audio`,`embed`,`iframe`,`img`,`input`,`script`,`source`,`track`,`video`]},wp={};function Tp(e,t){let n=t||wp;return Ep(e,typeof n.includeImageAlt==`boolean`?n.includeImageAlt:!0,typeof n.includeHtml==`boolean`?n.includeHtml:!0)}function Ep(e,t,n){if(Op(e)){if(`value`in e)return e.type===`html`&&!n?``:e.value;if(t&&`alt`in e&&e.alt)return e.alt;if(`children`in e)return Dp(e.children,t,n)}return Array.isArray(e)?Dp(e,t,n):``}function Dp(e,t,n){let r=[],i=-1;for(;++i<e.length;)r[i]=Ep(e[i],t,n);return r.join(``)}function Op(e){return!!(e&&typeof e==`object`)}var kp=document.createElement(`i`);function Ap(e){let t=`&`+e+`;`;kp.innerHTML=t;let n=kp.textContent;return n.charCodeAt(n.length-1)===59&&e!==`semi`||n===t?!1:n}function jp(e,t,n,r){let i=e.length,a=0,o;if(t=t<0?-t>i?0:i+t:t>i?i:t,n=n>0?n:0,r.length<1e4)o=Array.from(r),o.unshift(t,n),e.splice(...o);else for(n&&e.splice(t,n);a<r.length;)o=r.slice(a,a+1e4),o.unshift(t,0),e.splice(...o),a+=1e4,t+=1e4}function Mp(e,t){return e.length>0?(jp(e,e.length,0,t),e):t}var Np={}.hasOwnProperty;function Pp(e){let t={},n=-1;for(;++n<e.length;)Fp(t,e[n]);return t}function Fp(e,t){let n;for(n in t){let r=(Np.call(e,n)?e[n]:void 0)||(e[n]={}),i=t[n],a;if(i)for(a in i){Np.call(r,a)||(r[a]=[]);let e=i[a];Ip(r[a],Array.isArray(e)?e:e?[e]:[])}}}function Ip(e,t){let n=-1,r=[];for(;++n<t.length;)(t[n].add===`after`?e:r).push(t[n]);jp(e,0,0,r)}function Lp(e,t){let n=Number.parseInt(e,t);return n<9||n===11||n>13&&n<32||n>126&&n<160||n>55295&&n<57344||n>64975&&n<65008||(n&65535)==65535||(n&65535)==65534||n>1114111?`�`:String.fromCodePoint(n)}function Rp(e){return e.replace(/[\t\n\r ]+/g,` `).replace(/^ | $/g,``).toLowerCase().toUpperCase()}var zp=Yp(/[A-Za-z]/),Bp=Yp(/[\dA-Za-z]/),Vp=Yp(/[#-'*+\--9=?A-Z^-~]/);function Hp(e){return e!==null&&(e<32||e===127)}var Up=Yp(/\d/),Wp=Yp(/[\dA-Fa-f]/),Gp=Yp(/[!-/:-@[-`{-~]/);function Q(e){return e!==null&&e<-2}function Kp(e){return e!==null&&(e<0||e===32)}function $(e){return e===-2||e===-1||e===32}var qp=Yp(/\p{P}|\p{S}/u),Jp=Yp(/\s/);function Yp(e){return t;function t(t){return t!==null&&t>-1&&e.test(String.fromCharCode(t))}}function Xp(e){let t=[],n=-1,r=0,i=0;for(;++n<e.length;){let a=e.charCodeAt(n),o=``;if(a===37&&Bp(e.charCodeAt(n+1))&&Bp(e.charCodeAt(n+2)))i=2;else if(a<128)/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(a))||(o=String.fromCharCode(a));else if(a>55295&&a<57344){let t=e.charCodeAt(n+1);a<56320&&t>56319&&t<57344?(o=String.fromCharCode(a,t),i=1):o=`�`}else o=String.fromCharCode(a);o&&=(t.push(e.slice(r,n),encodeURIComponent(o)),r=n+i+1,``),i&&=(n+=i,0)}return t.join(``)+e.slice(r)}function Zp(e,t,n,r){let i=r?r-1:1/0,a=0;return o;function o(r){return $(r)?(e.enter(n),s(r)):t(r)}function s(r){return $(r)&&a++<i?(e.consume(r),s):(e.exit(n),t(r))}}var Qp={tokenize:$p};function $p(e){let t=e.attempt(this.parser.constructs.contentInitial,r,i),n;return t;function r(n){if(n===null){e.consume(n);return}return e.enter(`lineEnding`),e.consume(n),e.exit(`lineEnding`),Zp(e,t,`linePrefix`)}function i(t){return e.enter(`paragraph`),a(t)}function a(t){let r=e.enter(`chunkText`,{contentType:`text`,previous:n});return n&&(n.next=r),n=r,o(t)}function o(t){if(t===null){e.exit(`chunkText`),e.exit(`paragraph`),e.consume(t);return}return Q(t)?(e.consume(t),e.exit(`chunkText`),a):(e.consume(t),o)}}var em={tokenize:nm},tm={tokenize:rm};function nm(e){let t=this,n=[],r=0,i,a,o;return s;function s(i){if(r<n.length){let a=n[r];return t.containerState=a[1],e.attempt(a[0].continuation,c,l)(i)}return l(i)}function c(e){if(r++,t.containerState._closeFlow){t.containerState._closeFlow=void 0,i&&v();let n=t.events.length,a=n,o;for(;a--;)if(t.events[a][0]===`exit`&&t.events[a][1].type===`chunkFlow`){o=t.events[a][1].end;break}_(r);let s=n;for(;s<t.events.length;)t.events[s][1].end={...o},s++;return jp(t.events,a+1,0,t.events.slice(n)),t.events.length=s,l(e)}return s(e)}function l(a){if(r===n.length){if(!i)return f(a);if(i.currentConstruct&&i.currentConstruct.concrete)return m(a);t.interrupt=!!(i.currentConstruct&&!i._gfmTableDynamicInterruptHack)}return t.containerState={},e.check(tm,u,d)(a)}function u(e){return i&&v(),_(r),f(e)}function d(e){return t.parser.lazy[t.now().line]=r!==n.length,o=t.now().offset,m(e)}function f(n){return t.containerState={},e.attempt(tm,p,m)(n)}function p(e){return r++,n.push([t.currentConstruct,t.containerState]),f(e)}function m(n){if(n===null){i&&v(),_(0),e.consume(n);return}return i||=t.parser.flow(t.now()),e.enter(`chunkFlow`,{_tokenizer:i,contentType:`flow`,previous:a}),h(n)}function h(n){if(n===null){g(e.exit(`chunkFlow`),!0),_(0),e.consume(n);return}return Q(n)?(e.consume(n),g(e.exit(`chunkFlow`)),r=0,t.interrupt=void 0,s):(e.consume(n),h)}function g(e,n){let s=t.sliceStream(e);if(n&&s.push(null),e.previous=a,a&&(a.next=e),a=e,i.defineSkip(e.start),i.write(s),t.parser.lazy[e.start.line]){let e=i.events.length;for(;e--;)if(i.events[e][1].start.offset<o&&(!i.events[e][1].end||i.events[e][1].end.offset>o))return;let n=t.events.length,a=n,s,c;for(;a--;)if(t.events[a][0]===`exit`&&t.events[a][1].type===`chunkFlow`){if(s){c=t.events[a][1].end;break}s=!0}for(_(r),e=n;e<t.events.length;)t.events[e][1].end={...c},e++;jp(t.events,a+1,0,t.events.slice(n)),t.events.length=e}}function _(r){let i=n.length;for(;i-- >r;){let r=n[i];t.containerState=r[1],r[0].exit.call(t,e)}n.length=r}function v(){i.write([null]),a=void 0,i=void 0,t.containerState._closeFlow=void 0}}function rm(e,t,n){return Zp(e,e.attempt(this.parser.constructs.document,t,n),`linePrefix`,this.parser.constructs.disable.null.includes(`codeIndented`)?void 0:4)}function im(e){if(e===null||Kp(e)||Jp(e))return 1;if(qp(e))return 2}function am(e,t,n){let r=[],i=-1;for(;++i<e.length;){let a=e[i].resolveAll;a&&!r.includes(a)&&(t=a(t,n),r.push(a))}return t}var om={name:`attention`,resolveAll:sm,tokenize:cm};function sm(e,t){let n=-1,r,i,a,o,s,c,l,u;for(;++n<e.length;)if(e[n][0]===`enter`&&e[n][1].type===`attentionSequence`&&e[n][1]._close){for(r=n;r--;)if(e[r][0]===`exit`&&e[r][1].type===`attentionSequence`&&e[r][1]._open&&t.sliceSerialize(e[r][1]).charCodeAt(0)===t.sliceSerialize(e[n][1]).charCodeAt(0)){if((e[r][1]._close||e[n][1]._open)&&(e[n][1].end.offset-e[n][1].start.offset)%3&&!((e[r][1].end.offset-e[r][1].start.offset+e[n][1].end.offset-e[n][1].start.offset)%3))continue;c=e[r][1].end.offset-e[r][1].start.offset>1&&e[n][1].end.offset-e[n][1].start.offset>1?2:1;let d={...e[r][1].end},f={...e[n][1].start};lm(d,-c),lm(f,c),o={type:c>1?`strongSequence`:`emphasisSequence`,start:d,end:{...e[r][1].end}},s={type:c>1?`strongSequence`:`emphasisSequence`,start:{...e[n][1].start},end:f},a={type:c>1?`strongText`:`emphasisText`,start:{...e[r][1].end},end:{...e[n][1].start}},i={type:c>1?`strong`:`emphasis`,start:{...o.start},end:{...s.end}},e[r][1].end={...o.start},e[n][1].start={...s.end},l=[],e[r][1].end.offset-e[r][1].start.offset&&(l=Mp(l,[[`enter`,e[r][1],t],[`exit`,e[r][1],t]])),l=Mp(l,[[`enter`,i,t],[`enter`,o,t],[`exit`,o,t],[`enter`,a,t]]),l=Mp(l,am(t.parser.constructs.insideSpan.null,e.slice(r+1,n),t)),l=Mp(l,[[`exit`,a,t],[`enter`,s,t],[`exit`,s,t],[`exit`,i,t]]),e[n][1].end.offset-e[n][1].start.offset?(u=2,l=Mp(l,[[`enter`,e[n][1],t],[`exit`,e[n][1],t]])):u=0,jp(e,r-1,n-r+3,l),n=r+l.length-u-2;break}}for(n=-1;++n<e.length;)e[n][1].type===`attentionSequence`&&(e[n][1].type=`data`);return e}function cm(e,t){let n=this.parser.constructs.attentionMarkers.null,r=this.previous,i=im(r),a;return o;function o(t){return a=t,e.enter(`attentionSequence`),s(t)}function s(o){if(o===a)return e.consume(o),s;let c=e.exit(`attentionSequence`),l=im(o),u=!l||l===2&&i||n.includes(o),d=!i||i===2&&l||n.includes(r);return c._open=!!(a===42?u:u&&(i||!d)),c._close=!!(a===42?d:d&&(l||!u)),t(o)}}function lm(e,t){e.column+=t,e.offset+=t,e._bufferIndex+=t}var um={name:`autolink`,tokenize:dm};function dm(e,t,n){let r=0;return i;function i(t){return e.enter(`autolink`),e.enter(`autolinkMarker`),e.consume(t),e.exit(`autolinkMarker`),e.enter(`autolinkProtocol`),a}function a(t){return zp(t)?(e.consume(t),o):t===64?n(t):l(t)}function o(e){return e===43||e===45||e===46||Bp(e)?(r=1,s(e)):l(e)}function s(t){return t===58?(e.consume(t),r=0,c):(t===43||t===45||t===46||Bp(t))&&r++<32?(e.consume(t),s):(r=0,l(t))}function c(r){return r===62?(e.exit(`autolinkProtocol`),e.enter(`autolinkMarker`),e.consume(r),e.exit(`autolinkMarker`),e.exit(`autolink`),t):r===null||r===32||r===60||Hp(r)?n(r):(e.consume(r),c)}function l(t){return t===64?(e.consume(t),u):Vp(t)?(e.consume(t),l):n(t)}function u(e){return Bp(e)?d(e):n(e)}function d(n){return n===46?(e.consume(n),r=0,u):n===62?(e.exit(`autolinkProtocol`).type=`autolinkEmail`,e.enter(`autolinkMarker`),e.consume(n),e.exit(`autolinkMarker`),e.exit(`autolink`),t):f(n)}function f(t){if((t===45||Bp(t))&&r++<63){let n=t===45?f:d;return e.consume(t),n}return n(t)}}var fm={partial:!0,tokenize:pm};function pm(e,t,n){return r;function r(t){return $(t)?Zp(e,i,`linePrefix`)(t):i(t)}function i(e){return e===null||Q(e)?t(e):n(e)}}var mm={continuation:{tokenize:gm},exit:_m,name:`blockQuote`,tokenize:hm};function hm(e,t,n){let r=this;return i;function i(t){if(t===62){let n=r.containerState;return n.open||=(e.enter(`blockQuote`,{_container:!0}),!0),e.enter(`blockQuotePrefix`),e.enter(`blockQuoteMarker`),e.consume(t),e.exit(`blockQuoteMarker`),a}return n(t)}function a(n){return $(n)?(e.enter(`blockQuotePrefixWhitespace`),e.consume(n),e.exit(`blockQuotePrefixWhitespace`),e.exit(`blockQuotePrefix`),t):(e.exit(`blockQuotePrefix`),t(n))}}function gm(e,t,n){let r=this;return i;function i(t){return $(t)?Zp(e,a,`linePrefix`,r.parser.constructs.disable.null.includes(`codeIndented`)?void 0:4)(t):a(t)}function a(r){return e.attempt(mm,t,n)(r)}}function _m(e){e.exit(`blockQuote`)}var vm={name:`characterEscape`,tokenize:ym};function ym(e,t,n){return r;function r(t){return e.enter(`characterEscape`),e.enter(`escapeMarker`),e.consume(t),e.exit(`escapeMarker`),i}function i(r){return Gp(r)?(e.enter(`characterEscapeValue`),e.consume(r),e.exit(`characterEscapeValue`),e.exit(`characterEscape`),t):n(r)}}var bm={name:`characterReference`,tokenize:xm};function xm(e,t,n){let r=this,i=0,a,o;return s;function s(t){return e.enter(`characterReference`),e.enter(`characterReferenceMarker`),e.consume(t),e.exit(`characterReferenceMarker`),c}function c(t){return t===35?(e.enter(`characterReferenceMarkerNumeric`),e.consume(t),e.exit(`characterReferenceMarkerNumeric`),l):(e.enter(`characterReferenceValue`),a=31,o=Bp,u(t))}function l(t){return t===88||t===120?(e.enter(`characterReferenceMarkerHexadecimal`),e.consume(t),e.exit(`characterReferenceMarkerHexadecimal`),e.enter(`characterReferenceValue`),a=6,o=Wp,u):(e.enter(`characterReferenceValue`),a=7,o=Up,u(t))}function u(s){if(s===59&&i){let i=e.exit(`characterReferenceValue`);return o===Bp&&!Ap(r.sliceSerialize(i))?n(s):(e.enter(`characterReferenceMarker`),e.consume(s),e.exit(`characterReferenceMarker`),e.exit(`characterReference`),t)}return o(s)&&i++<a?(e.consume(s),u):n(s)}}var Sm={partial:!0,tokenize:Tm},Cm={concrete:!0,name:`codeFenced`,tokenize:wm};function wm(e,t,n){let r=this,i={partial:!0,tokenize:x},a=0,o=0,s;return c;function c(e){return l(e)}function l(t){let n=r.events[r.events.length-1];return a=n&&n[1].type===`linePrefix`?n[2].sliceSerialize(n[1],!0).length:0,s=t,e.enter(`codeFenced`),e.enter(`codeFencedFence`),e.enter(`codeFencedFenceSequence`),u(t)}function u(t){return t===s?(o++,e.consume(t),u):o<3?n(t):(e.exit(`codeFencedFenceSequence`),$(t)?Zp(e,d,`whitespace`)(t):d(t))}function d(n){return n===null||Q(n)?(e.exit(`codeFencedFence`),r.interrupt?t(n):e.check(Sm,h,b)(n)):(e.enter(`codeFencedFenceInfo`),e.enter(`chunkString`,{contentType:`string`}),f(n))}function f(t){return t===null||Q(t)?(e.exit(`chunkString`),e.exit(`codeFencedFenceInfo`),d(t)):$(t)?(e.exit(`chunkString`),e.exit(`codeFencedFenceInfo`),Zp(e,p,`whitespace`)(t)):t===96&&t===s?n(t):(e.consume(t),f)}function p(t){return t===null||Q(t)?d(t):(e.enter(`codeFencedFenceMeta`),e.enter(`chunkString`,{contentType:`string`}),m(t))}function m(t){return t===null||Q(t)?(e.exit(`chunkString`),e.exit(`codeFencedFenceMeta`),d(t)):t===96&&t===s?n(t):(e.consume(t),m)}function h(t){return e.attempt(i,b,g)(t)}function g(t){return e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),_}function _(t){return a>0&&$(t)?Zp(e,v,`linePrefix`,a+1)(t):v(t)}function v(t){return t===null||Q(t)?e.check(Sm,h,b)(t):(e.enter(`codeFlowValue`),y(t))}function y(t){return t===null||Q(t)?(e.exit(`codeFlowValue`),v(t)):(e.consume(t),y)}function b(n){return e.exit(`codeFenced`),t(n)}function x(e,t,n){let i=0;return a;function a(t){return e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),c}function c(t){return e.enter(`codeFencedFence`),$(t)?Zp(e,l,`linePrefix`,r.parser.constructs.disable.null.includes(`codeIndented`)?void 0:4)(t):l(t)}function l(t){return t===s?(e.enter(`codeFencedFenceSequence`),u(t)):n(t)}function u(t){return t===s?(i++,e.consume(t),u):i>=o?(e.exit(`codeFencedFenceSequence`),$(t)?Zp(e,d,`whitespace`)(t):d(t)):n(t)}function d(r){return r===null||Q(r)?(e.exit(`codeFencedFence`),t(r)):n(r)}}}function Tm(e,t,n){let r=this;return i;function i(t){return t===null?n(t):(e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),a)}function a(e){return r.parser.lazy[r.now().line]?n(e):t(e)}}var Em={name:`codeIndented`,tokenize:Om},Dm={partial:!0,tokenize:km};function Om(e,t,n){let r=this;return i;function i(t){return e.enter(`codeIndented`),Zp(e,a,`linePrefix`,5)(t)}function a(e){let t=r.events[r.events.length-1];return t&&t[1].type===`linePrefix`&&t[2].sliceSerialize(t[1],!0).length>=4?o(e):n(e)}function o(t){return t===null?c(t):Q(t)?e.attempt(Dm,o,c)(t):(e.enter(`codeFlowValue`),s(t))}function s(t){return t===null||Q(t)?(e.exit(`codeFlowValue`),o(t)):(e.consume(t),s)}function c(n){return e.exit(`codeIndented`),t(n)}}function km(e,t,n){let r=this;return i;function i(t){return r.parser.lazy[r.now().line]?n(t):Q(t)?(e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),i):Zp(e,a,`linePrefix`,5)(t)}function a(e){let a=r.events[r.events.length-1];return a&&a[1].type===`linePrefix`&&a[2].sliceSerialize(a[1],!0).length>=4?t(e):Q(e)?i(e):n(e)}}var Am={name:`codeText`,previous:Mm,resolve:jm,tokenize:Nm};function jm(e){let t=e.length-4,n=3,r,i;if((e[n][1].type===`lineEnding`||e[n][1].type===`space`)&&(e[t][1].type===`lineEnding`||e[t][1].type===`space`)){for(r=n;++r<t;)if(e[r][1].type===`codeTextData`){e[n][1].type=`codeTextPadding`,e[t][1].type=`codeTextPadding`,n+=2,t-=2;break}}for(r=n-1,t++;++r<=t;)i===void 0?r!==t&&e[r][1].type!==`lineEnding`&&(i=r):(r===t||e[r][1].type===`lineEnding`)&&(e[i][1].type=`codeTextData`,r!==i+2&&(e[i][1].end=e[r-1][1].end,e.splice(i+2,r-i-2),t-=r-i-2,r=i+2),i=void 0);return e}function Mm(e){return e!==96||this.events[this.events.length-1][1].type===`characterEscape`}function Nm(e,t,n){let r=0,i,a;return o;function o(t){return e.enter(`codeText`),e.enter(`codeTextSequence`),s(t)}function s(t){return t===96?(e.consume(t),r++,s):(e.exit(`codeTextSequence`),c(t))}function c(t){return t===null?n(t):t===32?(e.enter(`space`),e.consume(t),e.exit(`space`),c):t===96?(a=e.enter(`codeTextSequence`),i=0,u(t)):Q(t)?(e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),c):(e.enter(`codeTextData`),l(t))}function l(t){return t===null||t===32||t===96||Q(t)?(e.exit(`codeTextData`),c(t)):(e.consume(t),l)}function u(n){return n===96?(e.consume(n),i++,u):i===r?(e.exit(`codeTextSequence`),e.exit(`codeText`),t(n)):(a.type=`codeTextData`,l(n))}}var Pm=class{constructor(e){this.left=e?[...e]:[],this.right=[]}get(e){if(e<0||e>=this.left.length+this.right.length)throw RangeError("Cannot access index `"+e+"` in a splice buffer of size `"+(this.left.length+this.right.length)+"`");return e<this.left.length?this.left[e]:this.right[this.right.length-e+this.left.length-1]}get length(){return this.left.length+this.right.length}shift(){return this.setCursor(0),this.right.pop()}slice(e,t){let n=t??1/0;return n<this.left.length?this.left.slice(e,n):e>this.left.length?this.right.slice(this.right.length-n+this.left.length,this.right.length-e+this.left.length).reverse():this.left.slice(e).concat(this.right.slice(this.right.length-n+this.left.length).reverse())}splice(e,t,n){let r=t||0;this.setCursor(Math.trunc(e));let i=this.right.splice(this.right.length-r,1/0);return n&&Fm(this.left,n),i.reverse()}pop(){return this.setCursor(1/0),this.left.pop()}push(e){this.setCursor(1/0),this.left.push(e)}pushMany(e){this.setCursor(1/0),Fm(this.left,e)}unshift(e){this.setCursor(0),this.right.push(e)}unshiftMany(e){this.setCursor(0),Fm(this.right,e.reverse())}setCursor(e){if(!(e===this.left.length||e>this.left.length&&this.right.length===0||e<0&&this.left.length===0))if(e<this.left.length){let t=this.left.splice(e,1/0);Fm(this.right,t.reverse())}else{let t=this.right.splice(this.left.length+this.right.length-e,1/0);Fm(this.left,t.reverse())}}};function Fm(e,t){let n=0;if(t.length<1e4)e.push(...t);else for(;n<t.length;)e.push(...t.slice(n,n+1e4)),n+=1e4}function Im(e){let t={},n=-1,r,i,a,o,s,c,l,u=new Pm(e);for(;++n<u.length;){for(;n in t;)n=t[n];if(r=u.get(n),n&&r[1].type===`chunkFlow`&&u.get(n-1)[1].type===`listItemPrefix`&&(c=r[1]._tokenizer.events,a=0,a<c.length&&c[a][1].type===`lineEndingBlank`&&(a+=2),a<c.length&&c[a][1].type===`content`))for(;++a<c.length&&c[a][1].type!==`content`;)c[a][1].type===`chunkText`&&(c[a][1]._isInFirstContentOfListItem=!0,a++);if(r[0]===`enter`)r[1].contentType&&(Object.assign(t,Lm(u,n)),n=t[n],l=!0);else if(r[1]._container){for(a=n,i=void 0;a--;)if(o=u.get(a),o[1].type===`lineEnding`||o[1].type===`lineEndingBlank`)o[0]===`enter`&&(i&&(u.get(i)[1].type=`lineEndingBlank`),o[1].type=`lineEnding`,i=a);else if(!(o[1].type===`linePrefix`||o[1].type===`listItemIndent`))break;i&&(r[1].end={...u.get(i)[1].start},s=u.slice(i,n),s.unshift(r),u.splice(i,n-i+1,s))}}return jp(e,0,1/0,u.slice(0)),!l}function Lm(e,t){let n=e.get(t)[1],r=e.get(t)[2],i=t-1,a=[],o=n._tokenizer;o||(o=r.parser[n.contentType](n.start),n._contentTypeTextTrailing&&(o._contentTypeTextTrailing=!0));let s=o.events,c=[],l={},u,d,f=-1,p=n,m=0,h=0,g=[h];for(;p;){for(;e.get(++i)[1]!==p;);a.push(i),p._tokenizer||(u=r.sliceStream(p),p.next||u.push(null),d&&o.defineSkip(p.start),p._isInFirstContentOfListItem&&(o._gfmTasklistFirstContentOfListItem=!0),o.write(u),p._isInFirstContentOfListItem&&(o._gfmTasklistFirstContentOfListItem=void 0)),d=p,p=p.next}for(p=n;++f<s.length;)s[f][0]===`exit`&&s[f-1][0]===`enter`&&s[f][1].type===s[f-1][1].type&&s[f][1].start.line!==s[f][1].end.line&&(h=f+1,g.push(h),p._tokenizer=void 0,p.previous=void 0,p=p.next);for(o.events=[],p?(p._tokenizer=void 0,p.previous=void 0):g.pop(),f=g.length;f--;){let t=s.slice(g[f],g[f+1]),n=a.pop();c.push([n,n+t.length-1]),e.splice(n,2,t)}for(c.reverse(),f=-1;++f<c.length;)l[m+c[f][0]]=m+c[f][1],m+=c[f][1]-c[f][0]-1;return l}var Rm={resolve:Bm,tokenize:Vm},zm={partial:!0,tokenize:Hm};function Bm(e){return Im(e),e}function Vm(e,t){let n;return r;function r(t){return e.enter(`content`),n=e.enter(`chunkContent`,{contentType:`content`}),i(t)}function i(t){return t===null?a(t):Q(t)?e.check(zm,o,a)(t):(e.consume(t),i)}function a(n){return e.exit(`chunkContent`),e.exit(`content`),t(n)}function o(t){return e.consume(t),e.exit(`chunkContent`),n.next=e.enter(`chunkContent`,{contentType:`content`,previous:n}),n=n.next,i}}function Hm(e,t,n){let r=this;return i;function i(t){return e.exit(`chunkContent`),e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),Zp(e,a,`linePrefix`)}function a(i){if(i===null||Q(i))return n(i);let a=r.events[r.events.length-1];return!r.parser.constructs.disable.null.includes(`codeIndented`)&&a&&a[1].type===`linePrefix`&&a[2].sliceSerialize(a[1],!0).length>=4?t(i):e.interrupt(r.parser.constructs.flow,n,t)(i)}}function Um(e,t,n,r,i,a,o,s,c){let l=c||1/0,u=0;return d;function d(t){return t===60?(e.enter(r),e.enter(i),e.enter(a),e.consume(t),e.exit(a),f):t===null||t===32||t===41||Hp(t)?n(t):(e.enter(r),e.enter(o),e.enter(s),e.enter(`chunkString`,{contentType:`string`}),h(t))}function f(n){return n===62?(e.enter(a),e.consume(n),e.exit(a),e.exit(i),e.exit(r),t):(e.enter(s),e.enter(`chunkString`,{contentType:`string`}),p(n))}function p(t){return t===62?(e.exit(`chunkString`),e.exit(s),f(t)):t===null||t===60||Q(t)?n(t):(e.consume(t),t===92?m:p)}function m(t){return t===60||t===62||t===92?(e.consume(t),p):p(t)}function h(i){return!u&&(i===null||i===41||Kp(i))?(e.exit(`chunkString`),e.exit(s),e.exit(o),e.exit(r),t(i)):u<l&&i===40?(e.consume(i),u++,h):i===41?(e.consume(i),u--,h):i===null||i===32||i===40||Hp(i)?n(i):(e.consume(i),i===92?g:h)}function g(t){return t===40||t===41||t===92?(e.consume(t),h):h(t)}}function Wm(e,t,n,r,i,a){let o=this,s=0,c;return l;function l(t){return e.enter(r),e.enter(i),e.consume(t),e.exit(i),e.enter(a),u}function u(l){return s>999||l===null||l===91||l===93&&!c||l===94&&!s&&`_hiddenFootnoteSupport`in o.parser.constructs?n(l):l===93?(e.exit(a),e.enter(i),e.consume(l),e.exit(i),e.exit(r),t):Q(l)?(e.enter(`lineEnding`),e.consume(l),e.exit(`lineEnding`),u):(e.enter(`chunkString`,{contentType:`string`}),d(l))}function d(t){return t===null||t===91||t===93||Q(t)||s++>999?(e.exit(`chunkString`),u(t)):(e.consume(t),c||=!$(t),t===92?f:d)}function f(t){return t===91||t===92||t===93?(e.consume(t),s++,d):d(t)}}function Gm(e,t,n,r,i,a){let o;return s;function s(t){return t===34||t===39||t===40?(e.enter(r),e.enter(i),e.consume(t),e.exit(i),o=t===40?41:t,c):n(t)}function c(n){return n===o?(e.enter(i),e.consume(n),e.exit(i),e.exit(r),t):(e.enter(a),l(n))}function l(t){return t===o?(e.exit(a),c(o)):t===null?n(t):Q(t)?(e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),Zp(e,l,`linePrefix`)):(e.enter(`chunkString`,{contentType:`string`}),u(t))}function u(t){return t===o||t===null||Q(t)?(e.exit(`chunkString`),l(t)):(e.consume(t),t===92?d:u)}function d(t){return t===o||t===92?(e.consume(t),u):u(t)}}function Km(e,t){let n;return r;function r(i){return Q(i)?(e.enter(`lineEnding`),e.consume(i),e.exit(`lineEnding`),n=!0,r):$(i)?Zp(e,r,n?`linePrefix`:`lineSuffix`)(i):t(i)}}var qm={name:`definition`,tokenize:Ym},Jm={partial:!0,tokenize:Xm};function Ym(e,t,n){let r=this,i;return a;function a(t){return e.enter(`definition`),o(t)}function o(t){return Wm.call(r,e,s,n,`definitionLabel`,`definitionLabelMarker`,`definitionLabelString`)(t)}function s(t){return i=Rp(r.sliceSerialize(r.events[r.events.length-1][1]).slice(1,-1)),t===58?(e.enter(`definitionMarker`),e.consume(t),e.exit(`definitionMarker`),c):n(t)}function c(t){return Kp(t)?Km(e,l)(t):l(t)}function l(t){return Um(e,u,n,`definitionDestination`,`definitionDestinationLiteral`,`definitionDestinationLiteralMarker`,`definitionDestinationRaw`,`definitionDestinationString`)(t)}function u(t){return e.attempt(Jm,d,d)(t)}function d(t){return $(t)?Zp(e,f,`whitespace`)(t):f(t)}function f(a){return a===null||Q(a)?(e.exit(`definition`),r.parser.defined.push(i),t(a)):n(a)}}function Xm(e,t,n){return r;function r(t){return Kp(t)?Km(e,i)(t):n(t)}function i(t){return Gm(e,a,n,`definitionTitle`,`definitionTitleMarker`,`definitionTitleString`)(t)}function a(t){return $(t)?Zp(e,o,`whitespace`)(t):o(t)}function o(e){return e===null||Q(e)?t(e):n(e)}}var Zm={name:`hardBreakEscape`,tokenize:Qm};function Qm(e,t,n){return r;function r(t){return e.enter(`hardBreakEscape`),e.consume(t),i}function i(r){return Q(r)?(e.exit(`hardBreakEscape`),t(r)):n(r)}}var $m={name:`headingAtx`,resolve:eh,tokenize:th};function eh(e,t){let n=e.length-2,r=3,i,a;return e[r][1].type===`whitespace`&&(r+=2),n-2>r&&e[n][1].type===`whitespace`&&(n-=2),e[n][1].type===`atxHeadingSequence`&&(r===n-1||n-4>r&&e[n-2][1].type===`whitespace`)&&(n-=r+1===n?2:4),n>r&&(i={type:`atxHeadingText`,start:e[r][1].start,end:e[n][1].end},a={type:`chunkText`,start:e[r][1].start,end:e[n][1].end,contentType:`text`},jp(e,r,n-r+1,[[`enter`,i,t],[`enter`,a,t],[`exit`,a,t],[`exit`,i,t]])),e}function th(e,t,n){let r=0;return i;function i(t){return e.enter(`atxHeading`),a(t)}function a(t){return e.enter(`atxHeadingSequence`),o(t)}function o(t){return t===35&&r++<6?(e.consume(t),o):t===null||Kp(t)?(e.exit(`atxHeadingSequence`),s(t)):n(t)}function s(n){return n===35?(e.enter(`atxHeadingSequence`),c(n)):n===null||Q(n)?(e.exit(`atxHeading`),t(n)):$(n)?Zp(e,s,`whitespace`)(n):(e.enter(`atxHeadingText`),l(n))}function c(t){return t===35?(e.consume(t),c):(e.exit(`atxHeadingSequence`),s(t))}function l(t){return t===null||t===35||Kp(t)?(e.exit(`atxHeadingText`),s(t)):(e.consume(t),l)}}var nh=`address.article.aside.base.basefont.blockquote.body.caption.center.col.colgroup.dd.details.dialog.dir.div.dl.dt.fieldset.figcaption.figure.footer.form.frame.frameset.h1.h2.h3.h4.h5.h6.head.header.hr.html.iframe.legend.li.link.main.menu.menuitem.nav.noframes.ol.optgroup.option.p.param.search.section.summary.table.tbody.td.tfoot.th.thead.title.tr.track.ul`.split(`.`),rh=[`pre`,`script`,`style`,`textarea`],ih={concrete:!0,name:`htmlFlow`,resolveTo:sh,tokenize:ch},ah={partial:!0,tokenize:uh},oh={partial:!0,tokenize:lh};function sh(e){let t=e.length;for(;t--&&!(e[t][0]===`enter`&&e[t][1].type===`htmlFlow`););return t>1&&e[t-2][1].type===`linePrefix`&&(e[t][1].start=e[t-2][1].start,e[t+1][1].start=e[t-2][1].start,e.splice(t-2,2)),e}function ch(e,t,n){let r=this,i,a,o,s,c;return l;function l(e){return u(e)}function u(t){return e.enter(`htmlFlow`),e.enter(`htmlFlowData`),e.consume(t),d}function d(s){return s===33?(e.consume(s),f):s===47?(e.consume(s),a=!0,h):s===63?(e.consume(s),i=3,r.interrupt?t:P):zp(s)?(e.consume(s),o=String.fromCharCode(s),g):n(s)}function f(a){return a===45?(e.consume(a),i=2,p):a===91?(e.consume(a),i=5,s=0,m):zp(a)?(e.consume(a),i=4,r.interrupt?t:P):n(a)}function p(i){return i===45?(e.consume(i),r.interrupt?t:P):n(i)}function m(i){return i===`CDATA[`.charCodeAt(s++)?(e.consume(i),s===6?r.interrupt?t:O:m):n(i)}function h(t){return zp(t)?(e.consume(t),o=String.fromCharCode(t),g):n(t)}function g(s){if(s===null||s===47||s===62||Kp(s)){let c=s===47,l=o.toLowerCase();return!c&&!a&&rh.includes(l)?(i=1,r.interrupt?t(s):O(s)):nh.includes(o.toLowerCase())?(i=6,c?(e.consume(s),_):r.interrupt?t(s):O(s)):(i=7,r.interrupt&&!r.parser.lazy[r.now().line]?n(s):a?v(s):y(s))}return s===45||Bp(s)?(e.consume(s),o+=String.fromCharCode(s),g):n(s)}function _(i){return i===62?(e.consume(i),r.interrupt?t:O):n(i)}function v(t){return $(t)?(e.consume(t),v):E(t)}function y(t){return t===47?(e.consume(t),E):t===58||t===95||zp(t)?(e.consume(t),b):$(t)?(e.consume(t),y):E(t)}function b(t){return t===45||t===46||t===58||t===95||Bp(t)?(e.consume(t),b):x(t)}function x(t){return t===61?(e.consume(t),S):$(t)?(e.consume(t),x):y(t)}function S(t){return t===null||t===60||t===61||t===62||t===96?n(t):t===34||t===39?(e.consume(t),c=t,C):$(t)?(e.consume(t),S):w(t)}function C(t){return t===c?(e.consume(t),c=null,T):t===null||Q(t)?n(t):(e.consume(t),C)}function w(t){return t===null||t===34||t===39||t===47||t===60||t===61||t===62||t===96||Kp(t)?x(t):(e.consume(t),w)}function T(e){return e===47||e===62||$(e)?y(e):n(e)}function E(t){return t===62?(e.consume(t),D):n(t)}function D(t){return t===null||Q(t)?O(t):$(t)?(e.consume(t),D):n(t)}function O(t){return t===45&&i===2?(e.consume(t),j):t===60&&i===1?(e.consume(t),M):t===62&&i===4?(e.consume(t),F):t===63&&i===3?(e.consume(t),P):t===93&&i===5?(e.consume(t),N):Q(t)&&(i===6||i===7)?(e.exit(`htmlFlowData`),e.check(ah,ne,k)(t)):t===null||Q(t)?(e.exit(`htmlFlowData`),k(t)):(e.consume(t),O)}function k(t){return e.check(oh,A,ne)(t)}function A(t){return e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),ee}function ee(t){return t===null||Q(t)?k(t):(e.enter(`htmlFlowData`),O(t))}function j(t){return t===45?(e.consume(t),P):O(t)}function M(t){return t===47?(e.consume(t),o=``,te):O(t)}function te(t){if(t===62){let n=o.toLowerCase();return rh.includes(n)?(e.consume(t),F):O(t)}return zp(t)&&o.length<8?(e.consume(t),o+=String.fromCharCode(t),te):O(t)}function N(t){return t===93?(e.consume(t),P):O(t)}function P(t){return t===62?(e.consume(t),F):t===45&&i===2?(e.consume(t),P):O(t)}function F(t){return t===null||Q(t)?(e.exit(`htmlFlowData`),ne(t)):(e.consume(t),F)}function ne(n){return e.exit(`htmlFlow`),t(n)}}function lh(e,t,n){let r=this;return i;function i(t){return Q(t)?(e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),a):n(t)}function a(e){return r.parser.lazy[r.now().line]?n(e):t(e)}}function uh(e,t,n){return r;function r(r){return e.enter(`lineEnding`),e.consume(r),e.exit(`lineEnding`),e.attempt(fm,t,n)}}var dh={name:`htmlText`,tokenize:fh};function fh(e,t,n){let r=this,i,a,o;return s;function s(t){return e.enter(`htmlText`),e.enter(`htmlTextData`),e.consume(t),c}function c(t){return t===33?(e.consume(t),l):t===47?(e.consume(t),x):t===63?(e.consume(t),y):zp(t)?(e.consume(t),w):n(t)}function l(t){return t===45?(e.consume(t),u):t===91?(e.consume(t),a=0,m):zp(t)?(e.consume(t),v):n(t)}function u(t){return t===45?(e.consume(t),p):n(t)}function d(t){return t===null?n(t):t===45?(e.consume(t),f):Q(t)?(o=d,M(t)):(e.consume(t),d)}function f(t){return t===45?(e.consume(t),p):d(t)}function p(e){return e===62?j(e):e===45?f(e):d(e)}function m(t){return t===`CDATA[`.charCodeAt(a++)?(e.consume(t),a===6?h:m):n(t)}function h(t){return t===null?n(t):t===93?(e.consume(t),g):Q(t)?(o=h,M(t)):(e.consume(t),h)}function g(t){return t===93?(e.consume(t),_):h(t)}function _(t){return t===62?j(t):t===93?(e.consume(t),_):h(t)}function v(t){return t===null||t===62?j(t):Q(t)?(o=v,M(t)):(e.consume(t),v)}function y(t){return t===null?n(t):t===63?(e.consume(t),b):Q(t)?(o=y,M(t)):(e.consume(t),y)}function b(e){return e===62?j(e):y(e)}function x(t){return zp(t)?(e.consume(t),S):n(t)}function S(t){return t===45||Bp(t)?(e.consume(t),S):C(t)}function C(t){return Q(t)?(o=C,M(t)):$(t)?(e.consume(t),C):j(t)}function w(t){return t===45||Bp(t)?(e.consume(t),w):t===47||t===62||Kp(t)?T(t):n(t)}function T(t){return t===47?(e.consume(t),j):t===58||t===95||zp(t)?(e.consume(t),E):Q(t)?(o=T,M(t)):$(t)?(e.consume(t),T):j(t)}function E(t){return t===45||t===46||t===58||t===95||Bp(t)?(e.consume(t),E):D(t)}function D(t){return t===61?(e.consume(t),O):Q(t)?(o=D,M(t)):$(t)?(e.consume(t),D):T(t)}function O(t){return t===null||t===60||t===61||t===62||t===96?n(t):t===34||t===39?(e.consume(t),i=t,k):Q(t)?(o=O,M(t)):$(t)?(e.consume(t),O):(e.consume(t),A)}function k(t){return t===i?(e.consume(t),i=void 0,ee):t===null?n(t):Q(t)?(o=k,M(t)):(e.consume(t),k)}function A(t){return t===null||t===34||t===39||t===60||t===61||t===96?n(t):t===47||t===62||Kp(t)?T(t):(e.consume(t),A)}function ee(e){return e===47||e===62||Kp(e)?T(e):n(e)}function j(r){return r===62?(e.consume(r),e.exit(`htmlTextData`),e.exit(`htmlText`),t):n(r)}function M(t){return e.exit(`htmlTextData`),e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),te}function te(t){return $(t)?Zp(e,N,`linePrefix`,r.parser.constructs.disable.null.includes(`codeIndented`)?void 0:4)(t):N(t)}function N(t){return e.enter(`htmlTextData`),o(t)}}var ph={name:`labelEnd`,resolveAll:_h,resolveTo:vh,tokenize:yh},mh={tokenize:bh},hh={tokenize:xh},gh={tokenize:Sh};function _h(e){let t=-1,n=[];for(;++t<e.length;){let r=e[t][1];if(n.push(e[t]),r.type===`labelImage`||r.type===`labelLink`||r.type===`labelEnd`){let e=r.type===`labelImage`?4:2;r.type=`data`,t+=e}}return e.length!==n.length&&jp(e,0,e.length,n),e}function vh(e,t){let n=e.length,r=0,i,a,o,s;for(;n--;)if(i=e[n][1],a){if(i.type===`link`||i.type===`labelLink`&&i._inactive)break;e[n][0]===`enter`&&i.type===`labelLink`&&(i._inactive=!0)}else if(o){if(e[n][0]===`enter`&&(i.type===`labelImage`||i.type===`labelLink`)&&!i._balanced&&(a=n,i.type!==`labelLink`)){r=2;break}}else i.type===`labelEnd`&&(o=n);let c={type:e[a][1].type===`labelLink`?`link`:`image`,start:{...e[a][1].start},end:{...e[e.length-1][1].end}},l={type:`label`,start:{...e[a][1].start},end:{...e[o][1].end}},u={type:`labelText`,start:{...e[a+r+2][1].end},end:{...e[o-2][1].start}};return s=[[`enter`,c,t],[`enter`,l,t]],s=Mp(s,e.slice(a+1,a+r+3)),s=Mp(s,[[`enter`,u,t]]),s=Mp(s,am(t.parser.constructs.insideSpan.null,e.slice(a+r+4,o-3),t)),s=Mp(s,[[`exit`,u,t],e[o-2],e[o-1],[`exit`,l,t]]),s=Mp(s,e.slice(o+1)),s=Mp(s,[[`exit`,c,t]]),jp(e,a,e.length,s),e}function yh(e,t,n){let r=this,i=r.events.length,a,o;for(;i--;)if((r.events[i][1].type===`labelImage`||r.events[i][1].type===`labelLink`)&&!r.events[i][1]._balanced){a=r.events[i][1];break}return s;function s(t){return a?a._inactive?d(t):(o=r.parser.defined.includes(Rp(r.sliceSerialize({start:a.end,end:r.now()}))),e.enter(`labelEnd`),e.enter(`labelMarker`),e.consume(t),e.exit(`labelMarker`),e.exit(`labelEnd`),c):n(t)}function c(t){return t===40?e.attempt(mh,u,o?u:d)(t):t===91?e.attempt(hh,u,o?l:d)(t):o?u(t):d(t)}function l(t){return e.attempt(gh,u,d)(t)}function u(e){return t(e)}function d(e){return a._balanced=!0,n(e)}}function bh(e,t,n){return r;function r(t){return e.enter(`resource`),e.enter(`resourceMarker`),e.consume(t),e.exit(`resourceMarker`),i}function i(t){return Kp(t)?Km(e,a)(t):a(t)}function a(t){return t===41?u(t):Um(e,o,s,`resourceDestination`,`resourceDestinationLiteral`,`resourceDestinationLiteralMarker`,`resourceDestinationRaw`,`resourceDestinationString`,32)(t)}function o(t){return Kp(t)?Km(e,c)(t):u(t)}function s(e){return n(e)}function c(t){return t===34||t===39||t===40?Gm(e,l,n,`resourceTitle`,`resourceTitleMarker`,`resourceTitleString`)(t):u(t)}function l(t){return Kp(t)?Km(e,u)(t):u(t)}function u(r){return r===41?(e.enter(`resourceMarker`),e.consume(r),e.exit(`resourceMarker`),e.exit(`resource`),t):n(r)}}function xh(e,t,n){let r=this;return i;function i(t){return Wm.call(r,e,a,o,`reference`,`referenceMarker`,`referenceString`)(t)}function a(e){return r.parser.defined.includes(Rp(r.sliceSerialize(r.events[r.events.length-1][1]).slice(1,-1)))?t(e):n(e)}function o(e){return n(e)}}function Sh(e,t,n){return r;function r(t){return e.enter(`reference`),e.enter(`referenceMarker`),e.consume(t),e.exit(`referenceMarker`),i}function i(r){return r===93?(e.enter(`referenceMarker`),e.consume(r),e.exit(`referenceMarker`),e.exit(`reference`),t):n(r)}}var Ch={name:`labelStartImage`,resolveAll:ph.resolveAll,tokenize:wh};function wh(e,t,n){let r=this;return i;function i(t){return e.enter(`labelImage`),e.enter(`labelImageMarker`),e.consume(t),e.exit(`labelImageMarker`),a}function a(t){return t===91?(e.enter(`labelMarker`),e.consume(t),e.exit(`labelMarker`),e.exit(`labelImage`),o):n(t)}function o(e){return e===94&&`_hiddenFootnoteSupport`in r.parser.constructs?n(e):t(e)}}var Th={name:`labelStartLink`,resolveAll:ph.resolveAll,tokenize:Eh};function Eh(e,t,n){let r=this;return i;function i(t){return e.enter(`labelLink`),e.enter(`labelMarker`),e.consume(t),e.exit(`labelMarker`),e.exit(`labelLink`),a}function a(e){return e===94&&`_hiddenFootnoteSupport`in r.parser.constructs?n(e):t(e)}}var Dh={name:`lineEnding`,tokenize:Oh};function Oh(e,t){return n;function n(n){return e.enter(`lineEnding`),e.consume(n),e.exit(`lineEnding`),Zp(e,t,`linePrefix`)}}var kh={name:`thematicBreak`,tokenize:Ah};function Ah(e,t,n){let r=0,i;return a;function a(t){return e.enter(`thematicBreak`),o(t)}function o(e){return i=e,s(e)}function s(a){return a===i?(e.enter(`thematicBreakSequence`),c(a)):r>=3&&(a===null||Q(a))?(e.exit(`thematicBreak`),t(a)):n(a)}function c(t){return t===i?(e.consume(t),r++,c):(e.exit(`thematicBreakSequence`),$(t)?Zp(e,s,`whitespace`)(t):s(t))}}var jh={continuation:{tokenize:Fh},exit:Lh,name:`list`,tokenize:Ph},Mh={partial:!0,tokenize:Rh},Nh={partial:!0,tokenize:Ih};function Ph(e,t,n){let r=this,i=r.events[r.events.length-1],a=i&&i[1].type===`linePrefix`?i[2].sliceSerialize(i[1],!0).length:0,o=0;return s;function s(t){let i=r.containerState.type||(t===42||t===43||t===45?`listUnordered`:`listOrdered`);if(i===`listUnordered`?!r.containerState.marker||t===r.containerState.marker:Up(t)){if(r.containerState.type||(r.containerState.type=i,e.enter(i,{_container:!0})),i===`listUnordered`)return e.enter(`listItemPrefix`),t===42||t===45?e.check(kh,n,l)(t):l(t);if(!r.interrupt||t===49)return e.enter(`listItemPrefix`),e.enter(`listItemValue`),c(t)}return n(t)}function c(t){return Up(t)&&++o<10?(e.consume(t),c):(!r.interrupt||o<2)&&(r.containerState.marker?t===r.containerState.marker:t===41||t===46)?(e.exit(`listItemValue`),l(t)):n(t)}function l(t){return e.enter(`listItemMarker`),e.consume(t),e.exit(`listItemMarker`),r.containerState.marker=r.containerState.marker||t,e.check(fm,r.interrupt?n:u,e.attempt(Mh,f,d))}function u(e){return r.containerState.initialBlankLine=!0,a++,f(e)}function d(t){return $(t)?(e.enter(`listItemPrefixWhitespace`),e.consume(t),e.exit(`listItemPrefixWhitespace`),f):n(t)}function f(n){return r.containerState.size=a+r.sliceSerialize(e.exit(`listItemPrefix`),!0).length,t(n)}}function Fh(e,t,n){let r=this;return r.containerState._closeFlow=void 0,e.check(fm,i,a);function i(n){return r.containerState.furtherBlankLines=r.containerState.furtherBlankLines||r.containerState.initialBlankLine,Zp(e,t,`listItemIndent`,r.containerState.size+1)(n)}function a(n){return r.containerState.furtherBlankLines||!$(n)?(r.containerState.furtherBlankLines=void 0,r.containerState.initialBlankLine=void 0,o(n)):(r.containerState.furtherBlankLines=void 0,r.containerState.initialBlankLine=void 0,e.attempt(Nh,t,o)(n))}function o(i){return r.containerState._closeFlow=!0,r.interrupt=void 0,Zp(e,e.attempt(jh,t,n),`linePrefix`,r.parser.constructs.disable.null.includes(`codeIndented`)?void 0:4)(i)}}function Ih(e,t,n){let r=this;return Zp(e,i,`listItemIndent`,r.containerState.size+1);function i(e){let i=r.events[r.events.length-1];return i&&i[1].type===`listItemIndent`&&i[2].sliceSerialize(i[1],!0).length===r.containerState.size?t(e):n(e)}}function Lh(e){e.exit(this.containerState.type)}function Rh(e,t,n){let r=this;return Zp(e,i,`listItemPrefixWhitespace`,r.parser.constructs.disable.null.includes(`codeIndented`)?void 0:5);function i(e){let i=r.events[r.events.length-1];return!$(e)&&i&&i[1].type===`listItemPrefixWhitespace`?t(e):n(e)}}var zh={name:`setextUnderline`,resolveTo:Bh,tokenize:Vh};function Bh(e,t){let n=e.length,r,i,a;for(;n--;)if(e[n][0]===`enter`){if(e[n][1].type===`content`){r=n;break}e[n][1].type===`paragraph`&&(i=n)}else e[n][1].type===`content`&&e.splice(n,1),!a&&e[n][1].type===`definition`&&(a=n);let o={type:`setextHeading`,start:{...e[r][1].start},end:{...e[e.length-1][1].end}};return e[i][1].type=`setextHeadingText`,a?(e.splice(i,0,[`enter`,o,t]),e.splice(a+1,0,[`exit`,e[r][1],t]),e[r][1].end={...e[a][1].end}):e[r][1]=o,e.push([`exit`,o,t]),e}function Vh(e,t,n){let r=this,i;return a;function a(t){let a=r.events.length,s;for(;a--;)if(r.events[a][1].type!==`lineEnding`&&r.events[a][1].type!==`linePrefix`&&r.events[a][1].type!==`content`){s=r.events[a][1].type===`paragraph`;break}return!r.parser.lazy[r.now().line]&&(r.interrupt||s)?(e.enter(`setextHeadingLine`),i=t,o(t)):n(t)}function o(t){return e.enter(`setextHeadingLineSequence`),s(t)}function s(t){return t===i?(e.consume(t),s):(e.exit(`setextHeadingLineSequence`),$(t)?Zp(e,c,`lineSuffix`)(t):c(t))}function c(r){return r===null||Q(r)?(e.exit(`setextHeadingLine`),t(r)):n(r)}}var Hh={tokenize:Uh};function Uh(e){let t=this,n=e.attempt(fm,r,e.attempt(this.parser.constructs.flowInitial,i,Zp(e,e.attempt(this.parser.constructs.flow,i,e.attempt(Rm,i)),`linePrefix`)));return n;function r(r){if(r===null){e.consume(r);return}return e.enter(`lineEndingBlank`),e.consume(r),e.exit(`lineEndingBlank`),t.currentConstruct=void 0,n}function i(r){if(r===null){e.consume(r);return}return e.enter(`lineEnding`),e.consume(r),e.exit(`lineEnding`),t.currentConstruct=void 0,n}}var Wh={resolveAll:Jh()},Gh=qh(`string`),Kh=qh(`text`);function qh(e){return{resolveAll:Jh(e===`text`?Yh:void 0),tokenize:t};function t(t){let n=this,r=this.parser.constructs[e],i=t.attempt(r,a,o);return a;function a(e){return c(e)?i(e):o(e)}function o(e){if(e===null){t.consume(e);return}return t.enter(`data`),t.consume(e),s}function s(e){return c(e)?(t.exit(`data`),i(e)):(t.consume(e),s)}function c(e){if(e===null)return!0;let t=r[e],i=-1;if(t)for(;++i<t.length;){let e=t[i];if(!e.previous||e.previous.call(n,n.previous))return!0}return!1}}}function Jh(e){return t;function t(t,n){let r=-1,i;for(;++r<=t.length;)i===void 0?t[r]&&t[r][1].type===`data`&&(i=r,r++):(!t[r]||t[r][1].type!==`data`)&&(r!==i+2&&(t[i][1].end=t[r-1][1].end,t.splice(i+2,r-i-2),r=i+2),i=void 0);return e?e(t,n):t}}function Yh(e,t){let n=0;for(;++n<=e.length;)if((n===e.length||e[n][1].type===`lineEnding`)&&e[n-1][1].type===`data`){let r=e[n-1][1],i=t.sliceStream(r),a=i.length,o=-1,s=0,c;for(;a--;){let e=i[a];if(typeof e==`string`){for(o=e.length;e.charCodeAt(o-1)===32;)s++,o--;if(o)break;o=-1}else if(e===-2)c=!0,s++;else if(e!==-1){a++;break}}if(t._contentTypeTextTrailing&&n===e.length&&(s=0),s){let i={type:n===e.length||c||s<2?`lineSuffix`:`hardBreakTrailing`,start:{_bufferIndex:a?o:r.start._bufferIndex+o,_index:r.start._index+a,line:r.end.line,column:r.end.column-s,offset:r.end.offset-s},end:{...r.end}};r.end={...i.start},r.start.offset===r.end.offset?Object.assign(r,i):(e.splice(n,0,[`enter`,i,t],[`exit`,i,t]),n+=2)}n++}return e}var Xh=s({attentionMarkers:()=>ig,contentInitial:()=>Qh,disable:()=>ag,document:()=>Zh,flow:()=>eg,flowInitial:()=>$h,insideSpan:()=>rg,string:()=>tg,text:()=>ng}),Zh={42:jh,43:jh,45:jh,48:jh,49:jh,50:jh,51:jh,52:jh,53:jh,54:jh,55:jh,56:jh,57:jh,62:mm},Qh={91:qm},$h={[-2]:Em,[-1]:Em,32:Em},eg={35:$m,42:kh,45:[zh,kh],60:ih,61:zh,95:kh,96:Cm,126:Cm},tg={38:bm,92:vm},ng={[-5]:Dh,[-4]:Dh,[-3]:Dh,33:Ch,38:bm,42:om,60:[um,dh],91:Th,92:[Zm,vm],93:ph,95:om,96:Am},rg={null:[om,Wh]},ig={null:[42,95]},ag={null:[]};function og(e,t,n){let r={_bufferIndex:-1,_index:0,line:n&&n.line||1,column:n&&n.column||1,offset:n&&n.offset||0},i={},a=[],o=[],s=[],c={attempt:C(x),check:C(S),consume:v,enter:y,exit:b,interrupt:C(S,{interrupt:!0})},l={code:null,containerState:{},defineSkip:h,events:[],now:m,parser:e,previous:null,sliceSerialize:f,sliceStream:p,write:d},u=t.tokenize.call(l,c);return t.resolveAll&&a.push(t),l;function d(e){return o=Mp(o,e),g(),o[o.length-1]===null?(w(t,0),l.events=am(a,l.events,l),l.events):[]}function f(e,t){return cg(p(e),t)}function p(e){return sg(o,e)}function m(){let{_bufferIndex:e,_index:t,line:n,column:i,offset:a}=r;return{_bufferIndex:e,_index:t,line:n,column:i,offset:a}}function h(e){i[e.line]=e.column,E()}function g(){let e;for(;r._index<o.length;){let t=o[r._index];if(typeof t==`string`)for(e=r._index,r._bufferIndex<0&&(r._bufferIndex=0);r._index===e&&r._bufferIndex<t.length;)_(t.charCodeAt(r._bufferIndex));else _(t)}}function _(e){u=u(e)}function v(e){Q(e)?(r.line++,r.column=1,r.offset+=e===-3?2:1,E()):e!==-1&&(r.column++,r.offset++),r._bufferIndex<0?r._index++:(r._bufferIndex++,r._bufferIndex===o[r._index].length&&(r._bufferIndex=-1,r._index++)),l.previous=e}function y(e,t){let n=t||{};return n.type=e,n.start=m(),l.events.push([`enter`,n,l]),s.push(n),n}function b(e){let t=s.pop();return t.end=m(),l.events.push([`exit`,t,l]),t}function x(e,t){w(e,t.from)}function S(e,t){t.restore()}function C(e,t){return n;function n(n,r,i){let a,o,s,u;return Array.isArray(n)?f(n):`tokenize`in n?f([n]):d(n);function d(e){return t;function t(t){let n=t!==null&&e[t],r=t!==null&&e.null;return f([...Array.isArray(n)?n:n?[n]:[],...Array.isArray(r)?r:r?[r]:[]])(t)}}function f(e){return a=e,o=0,e.length===0?i:p(e[o])}function p(e){return n;function n(n){return u=T(),s=e,e.partial||(l.currentConstruct=e),e.name&&l.parser.constructs.disable.null.includes(e.name)?h(n):e.tokenize.call(t?Object.assign(Object.create(l),t):l,c,m,h)(n)}}function m(t){return e(s,u),r}function h(e){return u.restore(),++o<a.length?p(a[o]):i}}}function w(e,t){e.resolveAll&&!a.includes(e)&&a.push(e),e.resolve&&jp(l.events,t,l.events.length-t,e.resolve(l.events.slice(t),l)),e.resolveTo&&(l.events=e.resolveTo(l.events,l))}function T(){let e=m(),t=l.previous,n=l.currentConstruct,i=l.events.length,a=Array.from(s);return{from:i,restore:o};function o(){r=e,l.previous=t,l.currentConstruct=n,l.events.length=i,s=a,E()}}function E(){r.line in i&&r.column<2&&(r.column=i[r.line],r.offset+=i[r.line]-1)}}function sg(e,t){let n=t.start._index,r=t.start._bufferIndex,i=t.end._index,a=t.end._bufferIndex,o;if(n===i)o=[e[n].slice(r,a)];else{if(o=e.slice(n,i),r>-1){let e=o[0];typeof e==`string`?o[0]=e.slice(r):o.shift()}a>0&&o.push(e[i].slice(0,a))}return o}function cg(e,t){let n=-1,r=[],i;for(;++n<e.length;){let a=e[n],o;if(typeof a==`string`)o=a;else switch(a){case-5:o=`\r`;break;case-4:o=`
`;break;case-3:o=`\r
`;break;case-2:o=t?` `:`	`;break;case-1:if(!t&&i)continue;o=` `;break;default:o=String.fromCharCode(a)}i=a===-2,r.push(o)}return r.join(``)}function lg(e){let t={constructs:Pp([Xh,...(e||{}).extensions||[]]),content:n(Qp),defined:[],document:n(em),flow:n(Hh),lazy:{},string:n(Gh),text:n(Kh)};return t;function n(e){return n;function n(n){return og(t,e,n)}}}function ug(e){for(;!Im(e););return e}var dg=/[\0\t\n\r]/g;function fg(){let e=1,t=``,n=!0,r;return i;function i(i,a,o){let s=[],c,l,u,d,f;for(i=t+(typeof i==`string`?i.toString():new TextDecoder(a||void 0).decode(i)),u=0,t=``,n&&=(i.charCodeAt(0)===65279&&u++,void 0);u<i.length;){if(dg.lastIndex=u,c=dg.exec(i),d=c&&c.index!==void 0?c.index:i.length,f=i.charCodeAt(d),!c){t=i.slice(u);break}if(f===10&&u===d&&r)s.push(-3),r=void 0;else switch(r&&=(s.push(-5),void 0),u<d&&(s.push(i.slice(u,d)),e+=d-u),f){case 0:s.push(65533),e++;break;case 9:for(l=Math.ceil(e/4)*4,s.push(-2);e++<l;)s.push(-1);break;case 10:s.push(-4),e=1;break;default:r=!0,e=1}u=d+1}return o&&(r&&s.push(-5),t&&s.push(t),s.push(null)),s}}var pg=/\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;function mg(e){return e.replace(pg,hg)}function hg(e,t,n){if(t)return t;if(n.charCodeAt(0)===35){let e=n.charCodeAt(1),t=e===120||e===88;return Lp(n.slice(t?2:1),t?16:10)}return Ap(n)||e}var gg={}.hasOwnProperty;function _g(e,t,n){return t&&typeof t==`object`&&(n=t,t=void 0),vg(n)(ug(lg(n).document().write(fg()(e,t,!0))))}function vg(e){let t={transforms:[],canContainEols:[`emphasis`,`fragment`,`heading`,`paragraph`,`strong`],enter:{autolink:a(me),autolinkProtocol:T,autolinkEmail:T,atxHeading:a(de),blockQuote:a(ce),characterEscape:T,characterReference:T,codeFenced:a(le),codeFencedFenceInfo:o,codeFencedFenceMeta:o,codeIndented:a(le,o),codeText:a(ue,o),codeTextData:T,data:T,codeFlowValue:T,definition:a(R),definitionDestinationString:o,definitionLabelString:o,definitionTitleString:o,emphasis:a(z),hardBreakEscape:a(fe),hardBreakTrailing:a(fe),htmlFlow:a(pe,o),htmlFlowData:T,htmlText:a(pe,o),htmlTextData:T,image:a(B),label:o,link:a(me),listItem:a(H),listItemValue:f,listOrdered:a(V,d),listUnordered:a(V),paragraph:a(he),reference:re,referenceString:o,resourceDestinationString:o,resourceTitleString:o,setextHeading:a(de),strong:a(ge),thematicBreak:a(U)},exit:{atxHeading:c(),atxHeadingSequence:x,autolink:c(),autolinkEmail:se,autolinkProtocol:oe,blockQuote:c(),characterEscapeValue:E,characterReferenceMarkerHexadecimal:I,characterReferenceMarkerNumeric:I,characterReferenceValue:ae,characterReference:L,codeFenced:c(g),codeFencedFence:h,codeFencedFenceInfo:p,codeFencedFenceMeta:m,codeFlowValue:E,codeIndented:c(_),codeText:c(ee),codeTextData:E,data:E,definition:c(),definitionDestinationString:b,definitionLabelString:v,definitionTitleString:y,emphasis:c(),hardBreakEscape:c(O),hardBreakTrailing:c(O),htmlFlow:c(k),htmlFlowData:E,htmlText:c(A),htmlTextData:E,image:c(M),label:N,labelText:te,lineEnding:D,link:c(j),listItem:c(),listOrdered:c(),listUnordered:c(),paragraph:c(),referenceString:ie,resourceDestinationString:P,resourceTitleString:F,resource:ne,setextHeading:c(w),setextHeadingLineSequence:C,setextHeadingText:S,strong:c(),thematicBreak:c()}};bg(t,(e||{}).mdastExtensions||[]);let n={};return r;function r(e){let r={type:`root`,children:[]},a={stack:[r],tokenStack:[],config:t,enter:s,exit:l,buffer:o,resume:u,data:n},c=[],d=-1;for(;++d<e.length;)(e[d][1].type===`listOrdered`||e[d][1].type===`listUnordered`)&&(e[d][0]===`enter`?c.push(d):d=i(e,c.pop(),d));for(d=-1;++d<e.length;){let n=t[e[d][0]];gg.call(n,e[d][1].type)&&n[e[d][1].type].call(Object.assign({sliceSerialize:e[d][2].sliceSerialize},a),e[d][1])}if(a.tokenStack.length>0){let e=a.tokenStack[a.tokenStack.length-1];(e[1]||Sg).call(a,void 0,e[0])}for(r.position={start:yg(e.length>0?e[0][1].start:{line:1,column:1,offset:0}),end:yg(e.length>0?e[e.length-2][1].end:{line:1,column:1,offset:0})},d=-1;++d<t.transforms.length;)r=t.transforms[d](r)||r;return r}function i(e,t,n){let r=t-1,i=-1,a=!1,o,s,c,l;for(;++r<=n;){let t=e[r];switch(t[1].type){case`listUnordered`:case`listOrdered`:case`blockQuote`:t[0]===`enter`?i++:i--,l=void 0;break;case`lineEndingBlank`:t[0]===`enter`&&(o&&!l&&!i&&!c&&(c=r),l=void 0);break;case`linePrefix`:case`listItemValue`:case`listItemMarker`:case`listItemPrefix`:case`listItemPrefixWhitespace`:break;default:l=void 0}if(!i&&t[0]===`enter`&&t[1].type===`listItemPrefix`||i===-1&&t[0]===`exit`&&(t[1].type===`listUnordered`||t[1].type===`listOrdered`)){if(o){let i=r;for(s=void 0;i--;){let t=e[i];if(t[1].type===`lineEnding`||t[1].type===`lineEndingBlank`){if(t[0]===`exit`)continue;s&&(e[s][1].type=`lineEndingBlank`,a=!0),t[1].type=`lineEnding`,s=i}else if(!(t[1].type===`linePrefix`||t[1].type===`blockQuotePrefix`||t[1].type===`blockQuotePrefixWhitespace`||t[1].type===`blockQuoteMarker`||t[1].type===`listItemIndent`))break}c&&(!s||c<s)&&(o._spread=!0),o.end=Object.assign({},s?e[s][1].start:t[1].end),e.splice(s||r,0,[`exit`,o,t[2]]),r++,n++}if(t[1].type===`listItemPrefix`){let i={type:`listItem`,_spread:!1,start:Object.assign({},t[1].start),end:void 0};o=i,e.splice(r,0,[`enter`,i,t[2]]),r++,n++,c=void 0,l=!0}}}return e[t][1]._spread=a,n}function a(e,t){return n;function n(n){s.call(this,e(n),n),t&&t.call(this,n)}}function o(){this.stack.push({type:`fragment`,children:[]})}function s(e,t,n){this.stack[this.stack.length-1].children.push(e),this.stack.push(e),this.tokenStack.push([t,n||void 0]),e.position={start:yg(t.start),end:void 0}}function c(e){return t;function t(t){e&&e.call(this,t),l.call(this,t)}}function l(e,t){let n=this.stack.pop(),r=this.tokenStack.pop();if(r)r[0].type!==e.type&&(t?t.call(this,e,r[0]):(r[1]||Sg).call(this,e,r[0]));else throw Error("Cannot close `"+e.type+"` ("+Uf({start:e.start,end:e.end})+`): it’s not open`);n.position.end=yg(e.end)}function u(){return Tp(this.stack.pop())}function d(){this.data.expectingFirstListItemValue=!0}function f(e){if(this.data.expectingFirstListItemValue){let t=this.stack[this.stack.length-2];t.start=Number.parseInt(this.sliceSerialize(e),10),this.data.expectingFirstListItemValue=void 0}}function p(){let e=this.resume(),t=this.stack[this.stack.length-1];t.lang=e}function m(){let e=this.resume(),t=this.stack[this.stack.length-1];t.meta=e}function h(){this.data.flowCodeInside||(this.buffer(),this.data.flowCodeInside=!0)}function g(){let e=this.resume(),t=this.stack[this.stack.length-1];t.value=e.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g,``),this.data.flowCodeInside=void 0}function _(){let e=this.resume(),t=this.stack[this.stack.length-1];t.value=e.replace(/(\r?\n|\r)$/g,``)}function v(e){let t=this.resume(),n=this.stack[this.stack.length-1];n.label=t,n.identifier=Rp(this.sliceSerialize(e)).toLowerCase()}function y(){let e=this.resume(),t=this.stack[this.stack.length-1];t.title=e}function b(){let e=this.resume(),t=this.stack[this.stack.length-1];t.url=e}function x(e){let t=this.stack[this.stack.length-1];t.depth||=this.sliceSerialize(e).length}function S(){this.data.setextHeadingSlurpLineEnding=!0}function C(e){let t=this.stack[this.stack.length-1];t.depth=this.sliceSerialize(e).codePointAt(0)===61?1:2}function w(){this.data.setextHeadingSlurpLineEnding=void 0}function T(e){let t=this.stack[this.stack.length-1].children,n=t[t.length-1];(!n||n.type!==`text`)&&(n=_e(),n.position={start:yg(e.start),end:void 0},t.push(n)),this.stack.push(n)}function E(e){let t=this.stack.pop();t.value+=this.sliceSerialize(e),t.position.end=yg(e.end)}function D(e){let n=this.stack[this.stack.length-1];if(this.data.atHardBreak){let t=n.children[n.children.length-1];t.position.end=yg(e.end),this.data.atHardBreak=void 0;return}!this.data.setextHeadingSlurpLineEnding&&t.canContainEols.includes(n.type)&&(T.call(this,e),E.call(this,e))}function O(){this.data.atHardBreak=!0}function k(){let e=this.resume(),t=this.stack[this.stack.length-1];t.value=e}function A(){let e=this.resume(),t=this.stack[this.stack.length-1];t.value=e}function ee(){let e=this.resume(),t=this.stack[this.stack.length-1];t.value=e}function j(){let e=this.stack[this.stack.length-1];if(this.data.inReference){let t=this.data.referenceType||`shortcut`;e.type+=`Reference`,e.referenceType=t,delete e.url,delete e.title}else delete e.identifier,delete e.label;this.data.referenceType=void 0}function M(){let e=this.stack[this.stack.length-1];if(this.data.inReference){let t=this.data.referenceType||`shortcut`;e.type+=`Reference`,e.referenceType=t,delete e.url,delete e.title}else delete e.identifier,delete e.label;this.data.referenceType=void 0}function te(e){let t=this.sliceSerialize(e),n=this.stack[this.stack.length-2];n.label=mg(t),n.identifier=Rp(t).toLowerCase()}function N(){let e=this.stack[this.stack.length-1],t=this.resume(),n=this.stack[this.stack.length-1];this.data.inReference=!0,n.type===`link`?n.children=e.children:n.alt=t}function P(){let e=this.resume(),t=this.stack[this.stack.length-1];t.url=e}function F(){let e=this.resume(),t=this.stack[this.stack.length-1];t.title=e}function ne(){this.data.inReference=void 0}function re(){this.data.referenceType=`collapsed`}function ie(e){let t=this.resume(),n=this.stack[this.stack.length-1];n.label=t,n.identifier=Rp(this.sliceSerialize(e)).toLowerCase(),this.data.referenceType=`full`}function I(e){this.data.characterReferenceType=e.type}function ae(e){let t=this.sliceSerialize(e),n=this.data.characterReferenceType,r;n?(r=Lp(t,n===`characterReferenceMarkerNumeric`?10:16),this.data.characterReferenceType=void 0):r=Ap(t);let i=this.stack[this.stack.length-1];i.value+=r}function L(e){let t=this.stack.pop();t.position.end=yg(e.end)}function oe(e){E.call(this,e);let t=this.stack[this.stack.length-1];t.url=this.sliceSerialize(e)}function se(e){E.call(this,e);let t=this.stack[this.stack.length-1];t.url=`mailto:`+this.sliceSerialize(e)}function ce(){return{type:`blockquote`,children:[]}}function le(){return{type:`code`,lang:null,meta:null,value:``}}function ue(){return{type:`inlineCode`,value:``}}function R(){return{type:`definition`,identifier:``,label:null,title:null,url:``}}function z(){return{type:`emphasis`,children:[]}}function de(){return{type:`heading`,depth:0,children:[]}}function fe(){return{type:`break`}}function pe(){return{type:`html`,value:``}}function B(){return{type:`image`,title:null,url:``,alt:null}}function me(){return{type:`link`,title:null,url:``,children:[]}}function V(e){return{type:`list`,ordered:e.type===`listOrdered`,start:null,spread:e._spread,children:[]}}function H(e){return{type:`listItem`,spread:e._spread,checked:null,children:[]}}function he(){return{type:`paragraph`,children:[]}}function ge(){return{type:`strong`,children:[]}}function _e(){return{type:`text`,value:``}}function U(){return{type:`thematicBreak`}}}function yg(e){return{line:e.line,column:e.column,offset:e.offset}}function bg(e,t){let n=-1;for(;++n<t.length;){let r=t[n];Array.isArray(r)?bg(e,r):xg(e,r)}}function xg(e,t){let n;for(n in t)if(gg.call(t,n))switch(n){case`canContainEols`:{let r=t[n];r&&e[n].push(...r);break}case`transforms`:{let r=t[n];r&&e[n].push(...r);break}case`enter`:case`exit`:{let r=t[n];r&&Object.assign(e[n],r);break}}}function Sg(e,t){throw Error(e?"Cannot close `"+e.type+"` ("+Uf({start:e.start,end:e.end})+"): a different token (`"+t.type+"`, "+Uf({start:t.start,end:t.end})+`) is open`:"Cannot close document, a token (`"+t.type+"`, "+Uf({start:t.start,end:t.end})+`) is still open`)}function Cg(e){let t=this;t.parser=n;function n(n){return _g(n,{...t.data(`settings`),...e,extensions:t.data(`micromarkExtensions`)||[],mdastExtensions:t.data(`fromMarkdownExtensions`)||[]})}}function wg(e,t){let n={type:`element`,tagName:`blockquote`,properties:{},children:e.wrap(e.all(t),!0)};return e.patch(t,n),e.applyData(t,n)}function Tg(e,t){let n={type:`element`,tagName:`br`,properties:{},children:[]};return e.patch(t,n),[e.applyData(t,n),{type:`text`,value:`
`}]}function Eg(e,t){let n=t.value?t.value+`
`:``,r={},i=t.lang?t.lang.split(/\s+/):[];i.length>0&&(r.className=[`language-`+i[0]]);let a={type:`element`,tagName:`code`,properties:r,children:[{type:`text`,value:n}]};return t.meta&&(a.data={meta:t.meta}),e.patch(t,a),a=e.applyData(t,a),a={type:`element`,tagName:`pre`,properties:{},children:[a]},e.patch(t,a),a}function Dg(e,t){let n={type:`element`,tagName:`del`,properties:{},children:e.all(t)};return e.patch(t,n),e.applyData(t,n)}function Og(e,t){let n={type:`element`,tagName:`em`,properties:{},children:e.all(t)};return e.patch(t,n),e.applyData(t,n)}function kg(e,t){let n=typeof e.options.clobberPrefix==`string`?e.options.clobberPrefix:`user-content-`,r=String(t.identifier).toUpperCase(),i=Xp(r.toLowerCase()),a=e.footnoteOrder.indexOf(r),o,s=e.footnoteCounts.get(r);s===void 0?(s=0,e.footnoteOrder.push(r),o=e.footnoteOrder.length):o=a+1,s+=1,e.footnoteCounts.set(r,s);let c={type:`element`,tagName:`a`,properties:{href:`#`+n+`fn-`+i,id:n+`fnref-`+i+(s>1?`-`+s:``),dataFootnoteRef:!0,ariaDescribedBy:[`footnote-label`]},children:[{type:`text`,value:String(o)}]};e.patch(t,c);let l={type:`element`,tagName:`sup`,properties:{},children:[c]};return e.patch(t,l),e.applyData(t,l)}function Ag(e,t){let n={type:`element`,tagName:`h`+t.depth,properties:{},children:e.all(t)};return e.patch(t,n),e.applyData(t,n)}function jg(e,t){if(e.options.allowDangerousHtml){let n={type:`raw`,value:t.value};return e.patch(t,n),e.applyData(t,n)}}function Mg(e,t){let n=t.referenceType,r=`]`;if(n===`collapsed`?r+=`[]`:n===`full`&&(r+=`[`+(t.label||t.identifier)+`]`),t.type===`imageReference`)return[{type:`text`,value:`![`+t.alt+r}];let i=e.all(t),a=i[0];a&&a.type===`text`?a.value=`[`+a.value:i.unshift({type:`text`,value:`[`});let o=i[i.length-1];return o&&o.type===`text`?o.value+=r:i.push({type:`text`,value:r}),i}function Ng(e,t){let n=String(t.identifier).toUpperCase(),r=e.definitionById.get(n);if(!r)return Mg(e,t);let i={src:Xp(r.url||``),alt:t.alt};r.title!==null&&r.title!==void 0&&(i.title=r.title);let a={type:`element`,tagName:`img`,properties:i,children:[]};return e.patch(t,a),e.applyData(t,a)}function Pg(e,t){let n={src:Xp(t.url)};t.alt!==null&&t.alt!==void 0&&(n.alt=t.alt),t.title!==null&&t.title!==void 0&&(n.title=t.title);let r={type:`element`,tagName:`img`,properties:n,children:[]};return e.patch(t,r),e.applyData(t,r)}function Fg(e,t){let n={type:`text`,value:t.value.replace(/\r?\n|\r/g,` `)};e.patch(t,n);let r={type:`element`,tagName:`code`,properties:{},children:[n]};return e.patch(t,r),e.applyData(t,r)}function Ig(e,t){let n=String(t.identifier).toUpperCase(),r=e.definitionById.get(n);if(!r)return Mg(e,t);let i={href:Xp(r.url||``)};r.title!==null&&r.title!==void 0&&(i.title=r.title);let a={type:`element`,tagName:`a`,properties:i,children:e.all(t)};return e.patch(t,a),e.applyData(t,a)}function Lg(e,t){let n={href:Xp(t.url)};t.title!==null&&t.title!==void 0&&(n.title=t.title);let r={type:`element`,tagName:`a`,properties:n,children:e.all(t)};return e.patch(t,r),e.applyData(t,r)}function Rg(e,t,n){let r=e.all(t),i=n?zg(n):Bg(t),a={},o=[];if(typeof t.checked==`boolean`){let e=r[0],n;e&&e.type===`element`&&e.tagName===`p`?n=e:(n={type:`element`,tagName:`p`,properties:{},children:[]},r.unshift(n)),n.children.length>0&&n.children.unshift({type:`text`,value:` `}),n.children.unshift({type:`element`,tagName:`input`,properties:{type:`checkbox`,checked:t.checked,disabled:!0},children:[]}),a.className=[`task-list-item`]}let s=-1;for(;++s<r.length;){let e=r[s];(i||s!==0||e.type!==`element`||e.tagName!==`p`)&&o.push({type:`text`,value:`
`}),e.type===`element`&&e.tagName===`p`&&!i?o.push(...e.children):o.push(e)}let c=r[r.length-1];c&&(i||c.type!==`element`||c.tagName!==`p`)&&o.push({type:`text`,value:`
`});let l={type:`element`,tagName:`li`,properties:a,children:o};return e.patch(t,l),e.applyData(t,l)}function zg(e){let t=!1;if(e.type===`list`){t=e.spread||!1;let n=e.children,r=-1;for(;!t&&++r<n.length;)t=Bg(n[r])}return t}function Bg(e){return e.spread??e.children.length>1}function Vg(e,t){let n={},r=e.all(t),i=-1;for(typeof t.start==`number`&&t.start!==1&&(n.start=t.start);++i<r.length;){let e=r[i];if(e.type===`element`&&e.tagName===`li`&&e.properties&&Array.isArray(e.properties.className)&&e.properties.className.includes(`task-list-item`)){n.className=[`contains-task-list`];break}}let a={type:`element`,tagName:t.ordered?`ol`:`ul`,properties:n,children:e.wrap(r,!0)};return e.patch(t,a),e.applyData(t,a)}function Hg(e,t){let n={type:`element`,tagName:`p`,properties:{},children:e.all(t)};return e.patch(t,n),e.applyData(t,n)}function Ug(e,t){let n={type:`root`,children:e.wrap(e.all(t))};return e.patch(t,n),e.applyData(t,n)}function Wg(e,t){let n={type:`element`,tagName:`strong`,properties:{},children:e.all(t)};return e.patch(t,n),e.applyData(t,n)}function Gg(e,t){let n=e.all(t),r=n.shift(),i=[];if(r){let n={type:`element`,tagName:`thead`,properties:{},children:e.wrap([r],!0)};e.patch(t.children[0],n),i.push(n)}if(n.length>0){let r={type:`element`,tagName:`tbody`,properties:{},children:e.wrap(n,!0)},a=Bf(t.children[1]),o=zf(t.children[t.children.length-1]);a&&o&&(r.position={start:a,end:o}),i.push(r)}let a={type:`element`,tagName:`table`,properties:{},children:e.wrap(i,!0)};return e.patch(t,a),e.applyData(t,a)}function Kg(e,t,n){let r=n?n.children:void 0,i=(r?r.indexOf(t):1)===0?`th`:`td`,a=n&&n.type===`table`?n.align:void 0,o=a?a.length:t.children.length,s=-1,c=[];for(;++s<o;){let n=t.children[s],r={},o=a?a[s]:void 0;o&&(r.align=o);let l={type:`element`,tagName:i,properties:r,children:[]};n&&(l.children=e.all(n),e.patch(n,l),l=e.applyData(n,l)),c.push(l)}let l={type:`element`,tagName:`tr`,properties:{},children:e.wrap(c,!0)};return e.patch(t,l),e.applyData(t,l)}function qg(e,t){let n={type:`element`,tagName:`td`,properties:{},children:e.all(t)};return e.patch(t,n),e.applyData(t,n)}var Jg=9,Yg=32;function Xg(e){let t=String(e),n=/\r?\n|\r/g,r=n.exec(t),i=0,a=[];for(;r;)a.push(Zg(t.slice(i,r.index),i>0,!0),r[0]),i=r.index+r[0].length,r=n.exec(t);return a.push(Zg(t.slice(i),i>0,!1)),a.join(``)}function Zg(e,t,n){let r=0,i=e.length;if(t){let t=e.codePointAt(r);for(;t===Jg||t===Yg;)r++,t=e.codePointAt(r)}if(n){let t=e.codePointAt(i-1);for(;t===Jg||t===Yg;)i--,t=e.codePointAt(i-1)}return i>r?e.slice(r,i):``}function Qg(e,t){let n={type:`text`,value:Xg(String(t.value))};return e.patch(t,n),e.applyData(t,n)}function $g(e,t){let n={type:`element`,tagName:`hr`,properties:{},children:[]};return e.patch(t,n),e.applyData(t,n)}var e_={blockquote:wg,break:Tg,code:Eg,delete:Dg,emphasis:Og,footnoteReference:kg,heading:Ag,html:jg,imageReference:Ng,image:Pg,inlineCode:Fg,linkReference:Ig,link:Lg,listItem:Rg,list:Vg,paragraph:Hg,root:Ug,strong:Wg,table:Gg,tableCell:qg,tableRow:Kg,text:Qg,thematicBreak:$g,toml:t_,yaml:t_,definition:t_,footnoteDefinition:t_};function t_(){}var n_=typeof self==`object`?self:globalThis,r_=(e,t)=>{switch(e){case`Function`:case`SharedWorker`:case`Worker`:case`eval`:case`setInterval`:case`setTimeout`:throw TypeError(`unable to deserialize `+e)}return new n_[e](t)},i_=(e,t)=>{let n=(t,n)=>(e.set(n,t),t),r=i=>{if(e.has(i))return e.get(i);let[a,o]=t[i];switch(a){case 0:case-1:return n(o,i);case 1:{let e=n([],i);for(let t of o)e.push(r(t));return e}case 2:{let e=n({},i);for(let[t,n]of o)e[r(t)]=r(n);return e}case 3:return n(new Date(o),i);case 4:{let{source:e,flags:t}=o;return n(new RegExp(e,t),i)}case 5:{let e=n(new Map,i);for(let[t,n]of o)e.set(r(t),r(n));return e}case 6:{let e=n(new Set,i);for(let t of o)e.add(r(t));return e}case 7:{let{name:e,message:t}=o;return n(r_(e,t),i)}case 8:return n(BigInt(o),i);case`BigInt`:return n(Object(BigInt(o)),i);case`ArrayBuffer`:return n(new Uint8Array(o).buffer,o);case`DataView`:{let{buffer:e}=new Uint8Array(o);return n(new DataView(e),o)}}return n(r_(a,o),i)};return r},a_=e=>i_(new Map,e)(0),o_=``,{toString:s_}={},{keys:c_}=Object,l_=e=>{let t=typeof e;if(t!==`object`||!e)return[0,t];let n=s_.call(e).slice(8,-1);switch(n){case`Array`:return[1,o_];case`Object`:return[2,o_];case`Date`:return[3,o_];case`RegExp`:return[4,o_];case`Map`:return[5,o_];case`Set`:return[6,o_];case`DataView`:return[1,n]}return n.includes(`Array`)?[1,n]:n.includes(`Error`)?[7,n]:[2,n]},u_=([e,t])=>e===0&&(t===`function`||t===`symbol`),d_=(e,t,n,r)=>{let i=(e,t)=>{let i=r.push(e)-1;return n.set(t,i),i},a=r=>{if(n.has(r))return n.get(r);let[o,s]=l_(r);switch(o){case 0:{let t=r;switch(s){case`bigint`:o=8,t=r.toString();break;case`function`:case`symbol`:if(e)throw TypeError(`unable to serialize `+s);t=null;break;case`undefined`:return i([-1],r)}return i([o,t],r)}case 1:{if(s){let e=r;return s===`DataView`?e=new Uint8Array(r.buffer):s===`ArrayBuffer`&&(e=new Uint8Array(r)),i([s,[...e]],r)}let e=[],t=i([o,e],r);for(let t of r)e.push(a(t));return t}case 2:{if(s)switch(s){case`BigInt`:return i([s,r.toString()],r);case`Boolean`:case`Number`:case`String`:return i([s,r.valueOf()],r)}if(t&&`toJSON`in r)return a(r.toJSON());let n=[],c=i([o,n],r);for(let t of c_(r))(e||!u_(l_(r[t])))&&n.push([a(t),a(r[t])]);return c}case 3:return i([o,r.toISOString()],r);case 4:{let{source:e,flags:t}=r;return i([o,{source:e,flags:t}],r)}case 5:{let t=[],n=i([o,t],r);for(let[n,i]of r)(e||!(u_(l_(n))||u_(l_(i))))&&t.push([a(n),a(i)]);return n}case 6:{let t=[],n=i([o,t],r);for(let n of r)(e||!u_(l_(n)))&&t.push(a(n));return n}}let{message:c}=r;return i([o,{name:s,message:c}],r)};return a},f_=(e,{json:t,lossy:n}={})=>{let r=[];return d_(!(t||n),!!t,new Map,r)(e),r},p_=typeof structuredClone==`function`?(e,t)=>t&&(`json`in t||`lossy`in t)?a_(f_(e,t)):structuredClone(e):(e,t)=>a_(f_(e,t));function m_(e,t){let n=[{type:`text`,value:`↩`}];return t>1&&n.push({type:`element`,tagName:`sup`,properties:{},children:[{type:`text`,value:String(t)}]}),n}function h_(e,t){return`Back to reference `+(e+1)+(t>1?`-`+t:``)}function g_(e){let t=typeof e.options.clobberPrefix==`string`?e.options.clobberPrefix:`user-content-`,n=e.options.footnoteBackContent||m_,r=e.options.footnoteBackLabel||h_,i=e.options.footnoteLabel||`Footnotes`,a=e.options.footnoteLabelTagName||`h2`,o=e.options.footnoteLabelProperties||{className:[`sr-only`]},s=[],c=-1;for(;++c<e.footnoteOrder.length;){let i=e.footnoteById.get(e.footnoteOrder[c]);if(!i)continue;let a=e.all(i),o=String(i.identifier).toUpperCase(),l=Xp(o.toLowerCase()),u=0,d=[],f=e.footnoteCounts.get(o);for(;f!==void 0&&++u<=f;){d.length>0&&d.push({type:`text`,value:` `});let e=typeof n==`string`?n:n(c,u);typeof e==`string`&&(e={type:`text`,value:e}),d.push({type:`element`,tagName:`a`,properties:{href:`#`+t+`fnref-`+l+(u>1?`-`+u:``),dataFootnoteBackref:``,ariaLabel:typeof r==`string`?r:r(c,u),className:[`data-footnote-backref`]},children:Array.isArray(e)?e:[e]})}let p=a[a.length-1];if(p&&p.type===`element`&&p.tagName===`p`){let e=p.children[p.children.length-1];e&&e.type===`text`?e.value+=` `:p.children.push({type:`text`,value:` `}),p.children.push(...d)}else a.push(...d);let m={type:`element`,tagName:`li`,properties:{id:t+`fn-`+l},children:e.wrap(a,!0)};e.patch(i,m),s.push(m)}if(s.length!==0)return{type:`element`,tagName:`section`,properties:{dataFootnotes:!0,className:[`footnotes`]},children:[{type:`element`,tagName:a,properties:{...p_(o),id:`footnote-label`},children:[{type:`text`,value:i}]},{type:`text`,value:`
`},{type:`element`,tagName:`ol`,properties:{},children:e.wrap(s,!0)},{type:`text`,value:`
`}]}}var __=(function(e){if(e==null)return S_;if(typeof e==`function`)return x_(e);if(typeof e==`object`)return Array.isArray(e)?v_(e):y_(e);if(typeof e==`string`)return b_(e);throw Error(`Expected function, string, or object as test`)});function v_(e){let t=[],n=-1;for(;++n<e.length;)t[n]=__(e[n]);return x_(r);function r(...e){let n=-1;for(;++n<t.length;)if(t[n].apply(this,e))return!0;return!1}}function y_(e){let t=e;return x_(n);function n(n){let r=n,i;for(i in e)if(r[i]!==t[i])return!1;return!0}}function b_(e){return x_(t);function t(t){return t&&t.type===e}}function x_(e){return t;function t(t,n,r){return!!(C_(t)&&e.call(this,t,typeof n==`number`?n:void 0,r||void 0))}}function S_(){return!0}function C_(e){return typeof e==`object`&&!!e&&`type`in e}function w_(e){return e}var T_=[];function E_(e,t,n,r){let i;typeof t==`function`&&typeof n!=`function`?(r=n,n=t):i=t;let a=__(i),o=r?-1:1;s(e,void 0,[])();function s(e,i,c){let l=e&&typeof e==`object`?e:{};if(typeof l.type==`string`){let t=typeof l.tagName==`string`?l.tagName:typeof l.name==`string`?l.name:void 0;Object.defineProperty(u,`name`,{value:`node (`+w_(e.type+(t?`<`+t+`>`:``))+`)`})}return u;function u(){let l=T_,u,d,f;if((!t||a(e,i,c[c.length-1]||void 0))&&(l=D_(n(e,c)),l[0]===!1))return l;if(`children`in e&&e.children){let t=e;if(t.children&&l[0]!==`skip`)for(d=(r?t.children.length:-1)+o,f=c.concat(t);d>-1&&d<t.children.length;){let e=t.children[d];if(u=s(e,d,f)(),u[0]===!1)return u;d=typeof u[1]==`number`?u[1]:d+o}}return l}}}function D_(e){return Array.isArray(e)?e:typeof e==`number`?[!0,e]:e==null?T_:[e]}function O_(e,t,n,r){let i,a,o;typeof t==`function`&&typeof n!=`function`?(a=void 0,o=t,i=n):(a=t,o=n,i=r),E_(e,a,s,i);function s(e,t){let n=t[t.length-1],r=n?n.children.indexOf(e):void 0;return o(e,r,n)}}var k_={}.hasOwnProperty,A_={};function j_(e,t){let n=t||A_,r=new Map,i=new Map,a={all:s,applyData:N_,definitionById:r,footnoteById:i,footnoteCounts:new Map,footnoteOrder:[],handlers:{...e_,...n.handlers},one:o,options:n,patch:M_,wrap:F_};return O_(e,function(e){if(e.type===`definition`||e.type===`footnoteDefinition`){let t=e.type===`definition`?r:i,n=String(e.identifier).toUpperCase();t.has(n)||t.set(n,e)}}),a;function o(e,t){let n=e.type,r=a.handlers[n];if(k_.call(a.handlers,n)&&r)return r(a,e,t);if(a.options.passThrough&&a.options.passThrough.includes(n)){if(`children`in e){let{children:t,...n}=e,r=p_(n);return r.children=a.all(e),r}return p_(e)}return(a.options.unknownHandler||P_)(a,e,t)}function s(e){let t=[];if(`children`in e){let n=e.children,r=-1;for(;++r<n.length;){let i=a.one(n[r],e);if(i){if(r&&n[r-1].type===`break`&&(!Array.isArray(i)&&i.type===`text`&&(i.value=I_(i.value)),!Array.isArray(i)&&i.type===`element`)){let e=i.children[0];e&&e.type===`text`&&(e.value=I_(e.value))}Array.isArray(i)?t.push(...i):t.push(i)}}}return t}}function M_(e,t){e.position&&(t.position=Hf(e))}function N_(e,t){let n=t;if(e&&e.data){let t=e.data.hName,r=e.data.hChildren,i=e.data.hProperties;typeof t==`string`&&(n.type===`element`?n.tagName=t:n={type:`element`,tagName:t,properties:{},children:`children`in n?n.children:[n]}),n.type===`element`&&i&&Object.assign(n.properties,p_(i)),`children`in n&&n.children&&r!=null&&(n.children=r)}return n}function P_(e,t){let n=t.data||{},r=`value`in t&&!(k_.call(n,`hProperties`)||k_.call(n,`hChildren`))?{type:`text`,value:t.value}:{type:`element`,tagName:`div`,properties:{},children:e.all(t)};return e.patch(t,r),e.applyData(t,r)}function F_(e,t){let n=[],r=-1;for(t&&n.push({type:`text`,value:`
`});++r<e.length;)r&&n.push({type:`text`,value:`
`}),n.push(e[r]);return t&&e.length>0&&n.push({type:`text`,value:`
`}),n}function I_(e){let t=0,n=e.charCodeAt(t);for(;n===9||n===32;)t++,n=e.charCodeAt(t);return e.slice(t)}function L_(e,t){let n=j_(e,t),r=n.one(e,void 0),i=g_(n),a=Array.isArray(r)?{type:`root`,children:r}:r||{type:`root`,children:[]};return i&&(`children`in a,a.children.push({type:`text`,value:`
`},i)),a}function R_(e,t){return e&&`run`in e?async function(n,r){let i=L_(n,{file:r,...t});await e.run(i,r)}:function(n,r){return L_(n,{file:r,...e||t})}}function z_(e){if(e)throw e}var B_=o(((e,t)=>{var n=Object.prototype.hasOwnProperty,r=Object.prototype.toString,i=Object.defineProperty,a=Object.getOwnPropertyDescriptor,o=function(e){return typeof Array.isArray==`function`?Array.isArray(e):r.call(e)===`[object Array]`},s=function(e){if(!e||r.call(e)!==`[object Object]`)return!1;var t=n.call(e,`constructor`),i=e.constructor&&e.constructor.prototype&&n.call(e.constructor.prototype,`isPrototypeOf`);if(e.constructor&&!t&&!i)return!1;for(var a in e);return a===void 0||n.call(e,a)},c=function(e,t){i&&t.name===`__proto__`?i(e,t.name,{enumerable:!0,configurable:!0,value:t.newValue,writable:!0}):e[t.name]=t.newValue},l=function(e,t){if(t===`__proto__`){if(!n.call(e,t))return;if(a)return a(e,t).value}return e[t]};t.exports=function e(){var t,n,r,i,a,u,d=arguments[0],f=1,p=arguments.length,m=!1;for(typeof d==`boolean`&&(m=d,d=arguments[1]||{},f=2),(d==null||typeof d!=`object`&&typeof d!=`function`)&&(d={});f<p;++f)if(t=arguments[f],t!=null)for(n in t)r=l(d,n),i=l(t,n),d!==i&&(m&&i&&(s(i)||(a=o(i)))?(a?(a=!1,u=r&&o(r)?r:[]):u=r&&s(r)?r:{},c(d,{name:n,newValue:e(m,u,i)})):i!==void 0&&c(d,{name:n,newValue:i}));return d}}));function V_(e){if(typeof e!=`object`||!e)return!1;let t=Object.getPrototypeOf(e);return(t===null||t===Object.prototype||Object.getPrototypeOf(t)===null)&&!(Symbol.toStringTag in e)&&!(Symbol.iterator in e)}function H_(){let e=[],t={run:n,use:r};return t;function n(...t){let n=-1,r=t.pop();if(typeof r!=`function`)throw TypeError(`Expected function as last argument, not `+r);i(null,...t);function i(a,...o){let s=e[++n],c=-1;if(a){r(a);return}for(;++c<t.length;)(o[c]===null||o[c]===void 0)&&(o[c]=t[c]);t=o,s?U_(s,i)(...o):r(null,...o)}}function r(n){if(typeof n!=`function`)throw TypeError("Expected `middelware` to be a function, not "+n);return e.push(n),t}}function U_(e,t){let n;return r;function r(...t){let r=e.length>t.length,o;r&&t.push(i);try{o=e.apply(this,t)}catch(e){let t=e;if(r&&n)throw t;return i(t)}r||(o&&o.then&&typeof o.then==`function`?o.then(a,i):o instanceof Error?i(o):a(o))}function i(e,...r){n||(n=!0,t(e,...r))}function a(e){i(null,e)}}var W_={basename:G_,dirname:K_,extname:q_,join:J_,sep:`/`};function G_(e,t){if(t!==void 0&&typeof t!=`string`)throw TypeError(`"ext" argument must be a string`);Z_(e);let n=0,r=-1,i=e.length,a;if(t===void 0||t.length===0||t.length>e.length){for(;i--;)if(e.codePointAt(i)===47){if(a){n=i+1;break}}else r<0&&(a=!0,r=i+1);return r<0?``:e.slice(n,r)}if(t===e)return``;let o=-1,s=t.length-1;for(;i--;)if(e.codePointAt(i)===47){if(a){n=i+1;break}}else o<0&&(a=!0,o=i+1),s>-1&&(e.codePointAt(i)===t.codePointAt(s--)?s<0&&(r=i):(s=-1,r=o));return n===r?r=o:r<0&&(r=e.length),e.slice(n,r)}function K_(e){if(Z_(e),e.length===0)return`.`;let t=-1,n=e.length,r;for(;--n;)if(e.codePointAt(n)===47){if(r){t=n;break}}else r||=!0;return t<0?e.codePointAt(0)===47?`/`:`.`:t===1&&e.codePointAt(0)===47?`//`:e.slice(0,t)}function q_(e){Z_(e);let t=e.length,n=-1,r=0,i=-1,a=0,o;for(;t--;){let s=e.codePointAt(t);if(s===47){if(o){r=t+1;break}continue}n<0&&(o=!0,n=t+1),s===46?i<0?i=t:a!==1&&(a=1):i>-1&&(a=-1)}return i<0||n<0||a===0||a===1&&i===n-1&&i===r+1?``:e.slice(i,n)}function J_(...e){let t=-1,n;for(;++t<e.length;)Z_(e[t]),e[t]&&(n=n===void 0?e[t]:n+`/`+e[t]);return n===void 0?`.`:Y_(n)}function Y_(e){Z_(e);let t=e.codePointAt(0)===47,n=X_(e,!t);return n.length===0&&!t&&(n=`.`),n.length>0&&e.codePointAt(e.length-1)===47&&(n+=`/`),t?`/`+n:n}function X_(e,t){let n=``,r=0,i=-1,a=0,o=-1,s,c;for(;++o<=e.length;){if(o<e.length)s=e.codePointAt(o);else if(s===47)break;else s=47;if(s===47){if(!(i===o-1||a===1))if(i!==o-1&&a===2){if(n.length<2||r!==2||n.codePointAt(n.length-1)!==46||n.codePointAt(n.length-2)!==46){if(n.length>2){if(c=n.lastIndexOf(`/`),c!==n.length-1){c<0?(n=``,r=0):(n=n.slice(0,c),r=n.length-1-n.lastIndexOf(`/`)),i=o,a=0;continue}}else if(n.length>0){n=``,r=0,i=o,a=0;continue}}t&&(n=n.length>0?n+`/..`:`..`,r=2)}else n.length>0?n+=`/`+e.slice(i+1,o):n=e.slice(i+1,o),r=o-i-1;i=o,a=0}else s===46&&a>-1?a++:a=-1}return n}function Z_(e){if(typeof e!=`string`)throw TypeError(`Path must be a string. Received `+JSON.stringify(e))}var Q_={cwd:$_};function $_(){return`/`}function ev(e){return!!(typeof e==`object`&&e&&`href`in e&&e.href&&`protocol`in e&&e.protocol&&e.auth===void 0)}function tv(e){if(typeof e==`string`)e=new URL(e);else if(!ev(e)){let t=TypeError('The "path" argument must be of type string or an instance of URL. Received `'+e+"`");throw t.code=`ERR_INVALID_ARG_TYPE`,t}if(e.protocol!==`file:`){let e=TypeError(`The URL must be of scheme file`);throw e.code=`ERR_INVALID_URL_SCHEME`,e}return nv(e)}function nv(e){if(e.hostname!==``){let e=TypeError(`File URL host must be "localhost" or empty on darwin`);throw e.code=`ERR_INVALID_FILE_URL_HOST`,e}let t=e.pathname,n=-1;for(;++n<t.length;)if(t.codePointAt(n)===37&&t.codePointAt(n+1)===50){let e=t.codePointAt(n+2);if(e===70||e===102){let e=TypeError(`File URL path must not include encoded / characters`);throw e.code=`ERR_INVALID_FILE_URL_PATH`,e}}return decodeURIComponent(t)}var rv=[`history`,`path`,`basename`,`stem`,`extname`,`dirname`],iv=class{constructor(e){let t;t=e?ev(e)?{path:e}:typeof e==`string`||cv(e)?{value:e}:e:{},this.cwd=`cwd`in t?``:Q_.cwd(),this.data={},this.history=[],this.messages=[],this.value,this.map,this.result,this.stored;let n=-1;for(;++n<rv.length;){let e=rv[n];e in t&&t[e]!==void 0&&t[e]!==null&&(this[e]=e===`history`?[...t[e]]:t[e])}let r;for(r in t)rv.includes(r)||(this[r]=t[r])}get basename(){return typeof this.path==`string`?W_.basename(this.path):void 0}set basename(e){ov(e,`basename`),av(e,`basename`),this.path=W_.join(this.dirname||``,e)}get dirname(){return typeof this.path==`string`?W_.dirname(this.path):void 0}set dirname(e){sv(this.basename,`dirname`),this.path=W_.join(e||``,this.basename)}get extname(){return typeof this.path==`string`?W_.extname(this.path):void 0}set extname(e){if(av(e,`extname`),sv(this.dirname,`extname`),e){if(e.codePointAt(0)!==46)throw Error("`extname` must start with `.`");if(e.includes(`.`,1))throw Error("`extname` cannot contain multiple dots")}this.path=W_.join(this.dirname,this.stem+(e||``))}get path(){return this.history[this.history.length-1]}set path(e){ev(e)&&(e=tv(e)),ov(e,`path`),this.path!==e&&this.history.push(e)}get stem(){return typeof this.path==`string`?W_.basename(this.path,this.extname):void 0}set stem(e){ov(e,`stem`),av(e,`stem`),this.path=W_.join(this.dirname||``,e+(this.extname||``))}fail(e,t,n){let r=this.message(e,t,n);throw r.fatal=!0,r}info(e,t,n){let r=this.message(e,t,n);return r.fatal=void 0,r}message(e,t,n){let r=new qf(e,t,n);return this.path&&(r.name=this.path+`:`+r.name,r.file=this.path),r.fatal=!1,this.messages.push(r),r}toString(e){return this.value===void 0?``:typeof this.value==`string`?this.value:new TextDecoder(e||void 0).decode(this.value)}};function av(e,t){if(e&&e.includes(W_.sep))throw Error("`"+t+"` cannot be a path: did not expect `"+W_.sep+"`")}function ov(e,t){if(!e)throw Error("`"+t+"` cannot be empty")}function sv(e,t){if(!e)throw Error("Setting `"+t+"` requires `path` to be set too")}function cv(e){return!!(e&&typeof e==`object`&&`byteLength`in e&&`byteOffset`in e)}var lv=(function(e){let t=this.constructor.prototype,n=t[e],r=function(){return n.apply(r,arguments)};return Object.setPrototypeOf(r,t),r}),uv=l(B_(),1),dv={}.hasOwnProperty,fv=new class e extends lv{constructor(){super(`copy`),this.Compiler=void 0,this.Parser=void 0,this.attachers=[],this.compiler=void 0,this.freezeIndex=-1,this.frozen=void 0,this.namespace={},this.parser=void 0,this.transformers=H_()}copy(){let t=new e,n=-1;for(;++n<this.attachers.length;){let e=this.attachers[n];t.use(...e)}return t.data((0,uv.default)(!0,{},this.namespace)),t}data(e,t){return typeof e==`string`?arguments.length===2?(hv(`data`,this.frozen),this.namespace[e]=t,this):dv.call(this.namespace,e)&&this.namespace[e]||void 0:e?(hv(`data`,this.frozen),this.namespace=e,this):this.namespace}freeze(){if(this.frozen)return this;let e=this;for(;++this.freezeIndex<this.attachers.length;){let[t,...n]=this.attachers[this.freezeIndex];if(n[0]===!1)continue;n[0]===!0&&(n[0]=void 0);let r=t.call(e,...n);typeof r==`function`&&this.transformers.use(r)}return this.frozen=!0,this.freezeIndex=1/0,this}parse(e){this.freeze();let t=vv(e),n=this.parser||this.Parser;return pv(`parse`,n),n(String(t),t)}process(e,t){let n=this;return this.freeze(),pv(`process`,this.parser||this.Parser),mv(`process`,this.compiler||this.Compiler),t?r(void 0,t):new Promise(r);function r(r,i){let a=vv(e),o=n.parse(a);n.run(o,a,function(e,t,r){if(e||!t||!r)return s(e);let i=t,a=n.stringify(i,r);bv(a)?r.value=a:r.result=a,s(e,r)});function s(e,n){e||!n?i(e):r?r(n):t(void 0,n)}}}processSync(e){let t=!1,n;return this.freeze(),pv(`processSync`,this.parser||this.Parser),mv(`processSync`,this.compiler||this.Compiler),this.process(e,r),_v(`processSync`,`process`,t),n;function r(e,r){t=!0,z_(e),n=r}}run(e,t,n){gv(e),this.freeze();let r=this.transformers;return!n&&typeof t==`function`&&(n=t,t=void 0),n?i(void 0,n):new Promise(i);function i(i,a){let o=vv(t);r.run(e,o,s);function s(t,r,o){let s=r||e;t?a(t):i?i(s):n(void 0,s,o)}}}runSync(e,t){let n=!1,r;return this.run(e,t,i),_v(`runSync`,`run`,n),r;function i(e,t){z_(e),r=t,n=!0}}stringify(e,t){this.freeze();let n=vv(t),r=this.compiler||this.Compiler;return mv(`stringify`,r),gv(e),r(e,n)}use(e,...t){let n=this.attachers,r=this.namespace;if(hv(`use`,this.frozen),e!=null)if(typeof e==`function`)s(e,t);else if(typeof e==`object`)Array.isArray(e)?o(e):a(e);else throw TypeError("Expected usable value, not `"+e+"`");return this;function i(e){if(typeof e==`function`)s(e,[]);else if(typeof e==`object`)if(Array.isArray(e)){let[t,...n]=e;s(t,n)}else a(e);else throw TypeError("Expected usable value, not `"+e+"`")}function a(e){if(!(`plugins`in e)&&!(`settings`in e))throw Error("Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither");o(e.plugins),e.settings&&(r.settings=(0,uv.default)(!0,r.settings,e.settings))}function o(e){let t=-1;if(e!=null)if(Array.isArray(e))for(;++t<e.length;){let n=e[t];i(n)}else throw TypeError("Expected a list of plugins, not `"+e+"`")}function s(e,t){let r=-1,i=-1;for(;++r<n.length;)if(n[r][0]===e){i=r;break}if(i===-1)n.push([e,...t]);else if(t.length>0){let[r,...a]=t,o=n[i][1];V_(o)&&V_(r)&&(r=(0,uv.default)(!0,o,r)),n[i]=[e,r,...a]}}}}().freeze();function pv(e,t){if(typeof t!=`function`)throw TypeError("Cannot `"+e+"` without `parser`")}function mv(e,t){if(typeof t!=`function`)throw TypeError("Cannot `"+e+"` without `compiler`")}function hv(e,t){if(t)throw Error("Cannot call `"+e+"` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.")}function gv(e){if(!V_(e)||typeof e.type!=`string`)throw TypeError("Expected node, got `"+e+"`")}function _v(e,t,n){if(!n)throw Error("`"+e+"` finished async. Use `"+t+"` instead")}function vv(e){return yv(e)?e:new iv(e)}function yv(e){return!!(e&&typeof e==`object`&&`message`in e&&`messages`in e)}function bv(e){return typeof e==`string`||xv(e)}function xv(e){return!!(e&&typeof e==`object`&&`byteLength`in e&&`byteOffset`in e)}var Sv=[],Cv={allowDangerousHtml:!0},wv=/^(https?|ircs?|mailto|xmpp)$/i,Tv=[{from:`astPlugins`,id:`remove-buggy-html-in-markdown-parser`},{from:`allowDangerousHtml`,id:`remove-buggy-html-in-markdown-parser`},{from:`allowNode`,id:`replace-allownode-allowedtypes-and-disallowedtypes`,to:`allowElement`},{from:`allowedTypes`,id:`replace-allownode-allowedtypes-and-disallowedtypes`,to:`allowedElements`},{from:`className`,id:`remove-classname`},{from:`disallowedTypes`,id:`replace-allownode-allowedtypes-and-disallowedtypes`,to:`disallowedElements`},{from:`escapeHtml`,id:`remove-buggy-html-in-markdown-parser`},{from:`includeElementIndex`,id:`#remove-includeelementindex`},{from:`includeNodeIndex`,id:`change-includenodeindex-to-includeelementindex`},{from:`linkTarget`,id:`remove-linktarget`},{from:`plugins`,id:`change-plugins-to-remarkplugins`,to:`remarkPlugins`},{from:`rawSourcePos`,id:`#remove-rawsourcepos`},{from:`renderers`,id:`change-renderers-to-components`,to:`components`},{from:`source`,id:`change-source-to-children`,to:`children`},{from:`sourcePos`,id:`#remove-sourcepos`},{from:`transformImageUri`,id:`#add-urltransform`,to:`urlTransform`},{from:`transformLinkUri`,id:`#add-urltransform`,to:`urlTransform`}];function Ev(e){let t=Dv(e),n=Ov(e);return kv(t.runSync(t.parse(n),n),e)}function Dv(e){let t=e.rehypePlugins||Sv,n=e.remarkPlugins||Sv,r=e.remarkRehypeOptions?{...e.remarkRehypeOptions,...Cv}:Cv;return fv().use(Cg).use(n).use(R_,r).use(t)}function Ov(e){let t=e.children||``,n=new iv;return typeof t==`string`?n.value=t:``+t,n}function kv(e,t){let n=t.allowedElements,r=t.allowElement,i=t.components,a=t.disallowedElements,o=t.skipHtml,s=t.unwrapDisallowed,c=t.urlTransform||Av;for(let e of Tv)Object.hasOwn(t,e.from)&&``+e.from+(e.to?"use `"+e.to+"` instead":`remove it`)+e.id;return O_(e,l),tp(e,{Fragment:R.Fragment,components:i,ignoreInvalidStyle:!0,jsx:R.jsx,jsxs:R.jsxs,passKeys:!0,passNode:!0});function l(e,t,i){if(e.type===`raw`&&i&&typeof t==`number`)return o?i.children.splice(t,1):i.children[t]={type:`text`,value:e.value},t;if(e.type===`element`){let t;for(t in Cp)if(Object.hasOwn(Cp,t)&&Object.hasOwn(e.properties,t)){let n=e.properties[t],r=Cp[t];(r===null||r.includes(e.tagName))&&(e.properties[t]=c(String(n||``),t,e))}}if(e.type===`element`){let o=n?!n.includes(e.tagName):a?a.includes(e.tagName):!1;if(!o&&r&&typeof t==`number`&&(o=!r(e,t,i)),o&&i&&typeof t==`number`)return s&&e.children?i.children.splice(t,1,...e.children):i.children.splice(t,1),t}}}function Av(e){let t=e.indexOf(`:`),n=e.indexOf(`?`),r=e.indexOf(`#`),i=e.indexOf(`/`);return t===-1||i!==-1&&t>i||n!==-1&&t>n||r!==-1&&t>r||wv.test(e.slice(0,t))?e:``}function jv(e,t){let n=String(e);if(typeof t!=`string`)throw TypeError(`Expected character`);let r=0,i=n.indexOf(t);for(;i!==-1;)r++,i=n.indexOf(t,i+t.length);return r}function Mv(e){if(typeof e!=`string`)throw TypeError(`Expected a string`);return e.replace(/[|\\{}()[\]^$+*?.]/g,`\\$&`).replace(/-/g,`\\x2d`)}function Nv(e,t,n){let r=__((n||{}).ignore||[]),i=Pv(t),a=-1;for(;++a<i.length;)E_(e,`text`,o);function o(e,t){let n=-1,i;for(;++n<t.length;){let e=t[n],a=i?i.children:void 0;if(r(e,a?a.indexOf(e):void 0,i))return;i=e}if(i)return s(e,t)}function s(e,t){let n=t[t.length-1],r=i[a][0],o=i[a][1],s=0,c=n.children.indexOf(e),l=!1,u=[];r.lastIndex=0;let d=r.exec(e.value);for(;d;){let n=d.index,i={index:d.index,input:d.input,stack:[...t,e]},a=o(...d,i);if(typeof a==`string`&&(a=a.length>0?{type:`text`,value:a}:void 0),a===!1?r.lastIndex=n+1:(s!==n&&u.push({type:`text`,value:e.value.slice(s,n)}),Array.isArray(a)?u.push(...a):a&&u.push(a),s=n+d[0].length,l=!0),!r.global)break;d=r.exec(e.value)}return l?(s<e.value.length&&u.push({type:`text`,value:e.value.slice(s)}),n.children.splice(c,1,...u)):u=[e],c+u.length}}function Pv(e){let t=[];if(!Array.isArray(e))throw TypeError(`Expected find and replace tuple or list of tuples`);let n=!e[0]||Array.isArray(e[0])?e:[e],r=-1;for(;++r<n.length;){let e=n[r];t.push([Fv(e[0]),Iv(e[1])])}return t}function Fv(e){return typeof e==`string`?new RegExp(Mv(e),`g`):e}function Iv(e){return typeof e==`function`?e:function(){return e}}var Lv=`phrasing`,Rv=[`autolink`,`link`,`image`,`label`];function zv(){return{transforms:[qv],enter:{literalAutolink:Vv,literalAutolinkEmail:Hv,literalAutolinkHttp:Hv,literalAutolinkWww:Hv},exit:{literalAutolink:Kv,literalAutolinkEmail:Gv,literalAutolinkHttp:Uv,literalAutolinkWww:Wv}}}function Bv(){return{unsafe:[{character:`@`,before:`[+\\-.\\w]`,after:`[\\-.\\w]`,inConstruct:Lv,notInConstruct:Rv},{character:`.`,before:`[Ww]`,after:`[\\-.\\w]`,inConstruct:Lv,notInConstruct:Rv},{character:`:`,before:`[ps]`,after:`\\/`,inConstruct:Lv,notInConstruct:Rv}]}}function Vv(e){this.enter({type:`link`,title:null,url:``,children:[]},e)}function Hv(e){this.config.enter.autolinkProtocol.call(this,e)}function Uv(e){this.config.exit.autolinkProtocol.call(this,e)}function Wv(e){this.config.exit.data.call(this,e);let t=this.stack[this.stack.length-1];t.type,t.url=`http://`+this.sliceSerialize(e)}function Gv(e){this.config.exit.autolinkEmail.call(this,e)}function Kv(e){this.exit(e)}function qv(e){Nv(e,[[/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi,Jv],[/(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)/gu,Yv]],{ignore:[`link`,`linkReference`]})}function Jv(e,t,n,r,i){let a=``;if(!Qv(i)||(/^w/i.test(t)&&(n=t+n,t=``,a=`http://`),!Xv(n)))return!1;let o=Zv(n+r);if(!o[0])return!1;let s={type:`link`,title:null,url:a+t+o[0],children:[{type:`text`,value:t+o[0]}]};return o[1]?[s,{type:`text`,value:o[1]}]:s}function Yv(e,t,n,r){return!Qv(r,!0)||/[-\d_]$/.test(n)?!1:{type:`link`,title:null,url:`mailto:`+t+`@`+n,children:[{type:`text`,value:t+`@`+n}]}}function Xv(e){let t=e.split(`.`);return!(t.length<2||t[t.length-1]&&(/_/.test(t[t.length-1])||!/[a-zA-Z\d]/.test(t[t.length-1]))||t[t.length-2]&&(/_/.test(t[t.length-2])||!/[a-zA-Z\d]/.test(t[t.length-2])))}function Zv(e){let t=/[!"&'),.:;<>?\]}]+$/.exec(e);if(!t)return[e,void 0];e=e.slice(0,t.index);let n=t[0],r=n.indexOf(`)`),i=jv(e,`(`),a=jv(e,`)`);for(;r!==-1&&i>a;)e+=n.slice(0,r+1),n=n.slice(r+1),r=n.indexOf(`)`),a++;return[e,n]}function Qv(e,t){let n=e.input.charCodeAt(e.index-1);return(e.index===0||Jp(n)||qp(n))&&(!t||n!==47)}cy.peek=sy;function $v(){this.buffer()}function ey(e){this.enter({type:`footnoteReference`,identifier:``,label:``},e)}function ty(){this.buffer()}function ny(e){this.enter({type:`footnoteDefinition`,identifier:``,label:``,children:[]},e)}function ry(e){let t=this.resume(),n=this.stack[this.stack.length-1];n.type,n.identifier=Rp(this.sliceSerialize(e)).toLowerCase(),n.label=t}function iy(e){this.exit(e)}function ay(e){let t=this.resume(),n=this.stack[this.stack.length-1];n.type,n.identifier=Rp(this.sliceSerialize(e)).toLowerCase(),n.label=t}function oy(e){this.exit(e)}function sy(){return`[`}function cy(e,t,n,r){let i=n.createTracker(r),a=i.move(`[^`),o=n.enter(`footnoteReference`),s=n.enter(`reference`);return a+=i.move(n.safe(n.associationId(e),{after:`]`,before:a})),s(),o(),a+=i.move(`]`),a}function ly(){return{enter:{gfmFootnoteCallString:$v,gfmFootnoteCall:ey,gfmFootnoteDefinitionLabelString:ty,gfmFootnoteDefinition:ny},exit:{gfmFootnoteCallString:ry,gfmFootnoteCall:iy,gfmFootnoteDefinitionLabelString:ay,gfmFootnoteDefinition:oy}}}function uy(e){let t=!1;return e&&e.firstLineBlank&&(t=!0),{handlers:{footnoteDefinition:n,footnoteReference:cy},unsafe:[{character:`[`,inConstruct:[`label`,`phrasing`,`reference`]}]};function n(e,n,r,i){let a=r.createTracker(i),o=a.move(`[^`),s=r.enter(`footnoteDefinition`),c=r.enter(`label`);return o+=a.move(r.safe(r.associationId(e),{before:o,after:`]`})),c(),o+=a.move(`]:`),e.children&&e.children.length>0&&(a.shift(4),o+=a.move((t?`
`:` `)+r.indentLines(r.containerFlow(e,a.current()),t?fy:dy))),s(),o}}function dy(e,t,n){return t===0?e:fy(e,t,n)}function fy(e,t,n){return(n?``:`    `)+e}var py=[`autolink`,`destinationLiteral`,`destinationRaw`,`reference`,`titleQuote`,`titleApostrophe`];vy.peek=yy;function my(){return{canContainEols:[`delete`],enter:{strikethrough:gy},exit:{strikethrough:_y}}}function hy(){return{unsafe:[{character:`~`,inConstruct:`phrasing`,notInConstruct:py}],handlers:{delete:vy}}}function gy(e){this.enter({type:`delete`,children:[]},e)}function _y(e){this.exit(e)}function vy(e,t,n,r){let i=n.createTracker(r),a=n.enter(`strikethrough`),o=i.move(`~~`);return o+=n.containerPhrasing(e,{...i.current(),before:o,after:`~`}),o+=i.move(`~~`),a(),o}function yy(){return`~`}function by(e){return e.length}function xy(e,t){let n=t||{},r=(n.align||[]).concat(),i=n.stringLength||by,a=[],o=[],s=[],c=[],l=0,u=-1;for(;++u<e.length;){let t=[],r=[],a=-1;for(e[u].length>l&&(l=e[u].length);++a<e[u].length;){let o=Sy(e[u][a]);if(n.alignDelimiters!==!1){let e=i(o);r[a]=e,(c[a]===void 0||e>c[a])&&(c[a]=e)}t.push(o)}o[u]=t,s[u]=r}let d=-1;if(typeof r==`object`&&`length`in r)for(;++d<l;)a[d]=Cy(r[d]);else{let e=Cy(r);for(;++d<l;)a[d]=e}d=-1;let f=[],p=[];for(;++d<l;){let e=a[d],t=``,r=``;e===99?(t=`:`,r=`:`):e===108?t=`:`:e===114&&(r=`:`);let i=n.alignDelimiters===!1?1:Math.max(1,c[d]-t.length-r.length),o=t+`-`.repeat(i)+r;n.alignDelimiters!==!1&&(i=t.length+i+r.length,i>c[d]&&(c[d]=i),p[d]=i),f[d]=o}o.splice(1,0,f),s.splice(1,0,p),u=-1;let m=[];for(;++u<o.length;){let e=o[u],t=s[u];d=-1;let r=[];for(;++d<l;){let i=e[d]||``,o=``,s=``;if(n.alignDelimiters!==!1){let e=c[d]-(t[d]||0),n=a[d];n===114?o=` `.repeat(e):n===99?e%2?(o=` `.repeat(e/2+.5),s=` `.repeat(e/2-.5)):(o=` `.repeat(e/2),s=o):s=` `.repeat(e)}n.delimiterStart!==!1&&!d&&r.push(`|`),n.padding!==!1&&!(n.alignDelimiters===!1&&i===``)&&(n.delimiterStart!==!1||d)&&r.push(` `),n.alignDelimiters!==!1&&r.push(o),r.push(i),n.alignDelimiters!==!1&&r.push(s),n.padding!==!1&&r.push(` `),(n.delimiterEnd!==!1||d!==l-1)&&r.push(`|`)}m.push(n.delimiterEnd===!1?r.join(``).replace(/ +$/,``):r.join(``))}return m.join(`
`)}function Sy(e){return e==null?``:String(e)}function Cy(e){let t=typeof e==`string`?e.codePointAt(0):0;return t===67||t===99?99:t===76||t===108?108:t===82||t===114?114:0}function wy(e,t,n,r){let i=n.enter(`blockquote`),a=n.createTracker(r);a.move(`> `),a.shift(2);let o=n.indentLines(n.containerFlow(e,a.current()),Ty);return i(),o}function Ty(e,t,n){return`>`+(n?``:` `)+e}function Ey(e,t){return Dy(e,t.inConstruct,!0)&&!Dy(e,t.notInConstruct,!1)}function Dy(e,t,n){if(typeof t==`string`&&(t=[t]),!t||t.length===0)return n;let r=-1;for(;++r<t.length;)if(e.includes(t[r]))return!0;return!1}function Oy(e,t,n,r){let i=-1;for(;++i<n.unsafe.length;)if(n.unsafe[i].character===`
`&&Ey(n.stack,n.unsafe[i]))return/[ \t]/.test(r.before)?``:` `;return`\\
`}function ky(e,t){let n=String(e),r=n.indexOf(t),i=r,a=0,o=0;if(typeof t!=`string`)throw TypeError(`Expected substring`);for(;r!==-1;)r===i?++a>o&&(o=a):a=1,i=r+t.length,r=n.indexOf(t,i);return o}function Ay(e,t){return!!(t.options.fences===!1&&e.value&&!e.lang&&/[^ \r\n]/.test(e.value)&&!/^[\t ]*(?:[\r\n]|$)|(?:^|[\r\n])[\t ]*$/.test(e.value))}function jy(e){let t=e.options.fence||"`";if(t!=="`"&&t!==`~`)throw Error("Cannot serialize code with `"+t+"` for `options.fence`, expected `` ` `` or `~`");return t}function My(e,t,n,r){let i=jy(n),a=e.value||``,o=i==="`"?`GraveAccent`:`Tilde`;if(Ay(e,n)){let e=n.enter(`codeIndented`),t=n.indentLines(a,Ny);return e(),t}let s=n.createTracker(r),c=i.repeat(Math.max(ky(a,i)+1,3)),l=n.enter(`codeFenced`),u=s.move(c);if(e.lang){let t=n.enter(`codeFencedLang${o}`);u+=s.move(n.safe(e.lang,{before:u,after:` `,encode:["`"],...s.current()})),t()}if(e.lang&&e.meta){let t=n.enter(`codeFencedMeta${o}`);u+=s.move(` `),u+=s.move(n.safe(e.meta,{before:u,after:`
`,encode:["`"],...s.current()})),t()}return u+=s.move(`
`),a&&(u+=s.move(a+`
`)),u+=s.move(c),l(),u}function Ny(e,t,n){return(n?``:`    `)+e}function Py(e){let t=e.options.quote||`"`;if(t!==`"`&&t!==`'`)throw Error("Cannot serialize title with `"+t+"` for `options.quote`, expected `\"`, or `'`");return t}function Fy(e,t,n,r){let i=Py(n),a=i===`"`?`Quote`:`Apostrophe`,o=n.enter(`definition`),s=n.enter(`label`),c=n.createTracker(r),l=c.move(`[`);return l+=c.move(n.safe(n.associationId(e),{before:l,after:`]`,...c.current()})),l+=c.move(`]: `),s(),!e.url||/[\0- \u007F]/.test(e.url)?(s=n.enter(`destinationLiteral`),l+=c.move(`<`),l+=c.move(n.safe(e.url,{before:l,after:`>`,...c.current()})),l+=c.move(`>`)):(s=n.enter(`destinationRaw`),l+=c.move(n.safe(e.url,{before:l,after:e.title?` `:`
`,...c.current()}))),s(),e.title&&(s=n.enter(`title${a}`),l+=c.move(` `+i),l+=c.move(n.safe(e.title,{before:l,after:i,...c.current()})),l+=c.move(i),s()),o(),l}function Iy(e){let t=e.options.emphasis||`*`;if(t!==`*`&&t!==`_`)throw Error("Cannot serialize emphasis with `"+t+"` for `options.emphasis`, expected `*`, or `_`");return t}function Ly(e){return`&#x`+e.toString(16).toUpperCase()+`;`}function Ry(e,t,n){let r=im(e),i=im(t);return r===void 0?i===void 0?n===`_`?{inside:!0,outside:!0}:{inside:!1,outside:!1}:i===1?{inside:!0,outside:!0}:{inside:!1,outside:!0}:r===1?i===void 0?{inside:!1,outside:!1}:i===1?{inside:!0,outside:!0}:{inside:!1,outside:!1}:i===void 0?{inside:!1,outside:!1}:i===1?{inside:!0,outside:!1}:{inside:!1,outside:!1}}zy.peek=By;function zy(e,t,n,r){let i=Iy(n),a=n.enter(`emphasis`),o=n.createTracker(r),s=o.move(i),c=o.move(n.containerPhrasing(e,{after:i,before:s,...o.current()})),l=c.charCodeAt(0),u=Ry(r.before.charCodeAt(r.before.length-1),l,i);u.inside&&(c=Ly(l)+c.slice(1));let d=c.charCodeAt(c.length-1),f=Ry(r.after.charCodeAt(0),d,i);f.inside&&(c=c.slice(0,-1)+Ly(d));let p=o.move(i);return a(),n.attentionEncodeSurroundingInfo={after:f.outside,before:u.outside},s+c+p}function By(e,t,n){return n.options.emphasis||`*`}function Vy(e,t){let n=!1;return O_(e,function(e){if(`value`in e&&/\r?\n|\r/.test(e.value)||e.type===`break`)return n=!0,!1}),!!((!e.depth||e.depth<3)&&Tp(e)&&(t.options.setext||n))}function Hy(e,t,n,r){let i=Math.max(Math.min(6,e.depth||1),1),a=n.createTracker(r);if(Vy(e,n)){let t=n.enter(`headingSetext`),r=n.enter(`phrasing`),o=n.containerPhrasing(e,{...a.current(),before:`
`,after:`
`});return r(),t(),o+`
`+(i===1?`=`:`-`).repeat(o.length-(Math.max(o.lastIndexOf(`\r`),o.lastIndexOf(`
`))+1))}let o=`#`.repeat(i),s=n.enter(`headingAtx`),c=n.enter(`phrasing`);a.move(o+` `);let l=n.containerPhrasing(e,{before:`# `,after:`
`,...a.current()});return/^[\t ]/.test(l)&&(l=Ly(l.charCodeAt(0))+l.slice(1)),l=l?o+` `+l:o,n.options.closeAtx&&(l+=` `+o),c(),s(),l}Uy.peek=Wy;function Uy(e){return e.value||``}function Wy(){return`<`}Gy.peek=Ky;function Gy(e,t,n,r){let i=Py(n),a=i===`"`?`Quote`:`Apostrophe`,o=n.enter(`image`),s=n.enter(`label`),c=n.createTracker(r),l=c.move(`![`);return l+=c.move(n.safe(e.alt,{before:l,after:`]`,...c.current()})),l+=c.move(`](`),s(),!e.url&&e.title||/[\0- \u007F]/.test(e.url)?(s=n.enter(`destinationLiteral`),l+=c.move(`<`),l+=c.move(n.safe(e.url,{before:l,after:`>`,...c.current()})),l+=c.move(`>`)):(s=n.enter(`destinationRaw`),l+=c.move(n.safe(e.url,{before:l,after:e.title?` `:`)`,...c.current()}))),s(),e.title&&(s=n.enter(`title${a}`),l+=c.move(` `+i),l+=c.move(n.safe(e.title,{before:l,after:i,...c.current()})),l+=c.move(i),s()),l+=c.move(`)`),o(),l}function Ky(){return`!`}qy.peek=Jy;function qy(e,t,n,r){let i=e.referenceType,a=n.enter(`imageReference`),o=n.enter(`label`),s=n.createTracker(r),c=s.move(`![`),l=n.safe(e.alt,{before:c,after:`]`,...s.current()});c+=s.move(l+`][`),o();let u=n.stack;n.stack=[],o=n.enter(`reference`);let d=n.safe(n.associationId(e),{before:c,after:`]`,...s.current()});return o(),n.stack=u,a(),i===`full`||!l||l!==d?c+=s.move(d+`]`):i===`shortcut`?c=c.slice(0,-1):c+=s.move(`]`),c}function Jy(){return`!`}Yy.peek=Xy;function Yy(e,t,n){let r=e.value||``,i="`",a=-1;for(;RegExp("(^|[^`])"+i+"([^`]|$)").test(r);)i+="`";for(/[^ \r\n]/.test(r)&&(/^[ \r\n]/.test(r)&&/[ \r\n]$/.test(r)||/^`|`$/.test(r))&&(r=` `+r+` `);++a<n.unsafe.length;){let e=n.unsafe[a],t=n.compilePattern(e),i;if(e.atBreak)for(;i=t.exec(r);){let e=i.index;r.charCodeAt(e)===10&&r.charCodeAt(e-1)===13&&e--,r=r.slice(0,e)+` `+r.slice(i.index+1)}}return i+r+i}function Xy(){return"`"}function Zy(e,t){let n=Tp(e);return!!(!t.options.resourceLink&&e.url&&!e.title&&e.children&&e.children.length===1&&e.children[0].type===`text`&&(n===e.url||`mailto:`+n===e.url)&&/^[a-z][a-z+.-]+:/i.test(e.url)&&!/[\0- <>\u007F]/.test(e.url))}Qy.peek=$y;function Qy(e,t,n,r){let i=Py(n),a=i===`"`?`Quote`:`Apostrophe`,o=n.createTracker(r),s,c;if(Zy(e,n)){let t=n.stack;n.stack=[],s=n.enter(`autolink`);let r=o.move(`<`);return r+=o.move(n.containerPhrasing(e,{before:r,after:`>`,...o.current()})),r+=o.move(`>`),s(),n.stack=t,r}s=n.enter(`link`),c=n.enter(`label`);let l=o.move(`[`);return l+=o.move(n.containerPhrasing(e,{before:l,after:`](`,...o.current()})),l+=o.move(`](`),c(),!e.url&&e.title||/[\0- \u007F]/.test(e.url)?(c=n.enter(`destinationLiteral`),l+=o.move(`<`),l+=o.move(n.safe(e.url,{before:l,after:`>`,...o.current()})),l+=o.move(`>`)):(c=n.enter(`destinationRaw`),l+=o.move(n.safe(e.url,{before:l,after:e.title?` `:`)`,...o.current()}))),c(),e.title&&(c=n.enter(`title${a}`),l+=o.move(` `+i),l+=o.move(n.safe(e.title,{before:l,after:i,...o.current()})),l+=o.move(i),c()),l+=o.move(`)`),s(),l}function $y(e,t,n){return Zy(e,n)?`<`:`[`}eb.peek=tb;function eb(e,t,n,r){let i=e.referenceType,a=n.enter(`linkReference`),o=n.enter(`label`),s=n.createTracker(r),c=s.move(`[`),l=n.containerPhrasing(e,{before:c,after:`]`,...s.current()});c+=s.move(l+`][`),o();let u=n.stack;n.stack=[],o=n.enter(`reference`);let d=n.safe(n.associationId(e),{before:c,after:`]`,...s.current()});return o(),n.stack=u,a(),i===`full`||!l||l!==d?c+=s.move(d+`]`):i===`shortcut`?c=c.slice(0,-1):c+=s.move(`]`),c}function tb(){return`[`}function nb(e){let t=e.options.bullet||`*`;if(t!==`*`&&t!==`+`&&t!==`-`)throw Error("Cannot serialize items with `"+t+"` for `options.bullet`, expected `*`, `+`, or `-`");return t}function rb(e){let t=nb(e),n=e.options.bulletOther;if(!n)return t===`*`?`-`:`*`;if(n!==`*`&&n!==`+`&&n!==`-`)throw Error("Cannot serialize items with `"+n+"` for `options.bulletOther`, expected `*`, `+`, or `-`");if(n===t)throw Error("Expected `bullet` (`"+t+"`) and `bulletOther` (`"+n+"`) to be different");return n}function ib(e){let t=e.options.bulletOrdered||`.`;if(t!==`.`&&t!==`)`)throw Error("Cannot serialize items with `"+t+"` for `options.bulletOrdered`, expected `.` or `)`");return t}function ab(e){let t=e.options.rule||`*`;if(t!==`*`&&t!==`-`&&t!==`_`)throw Error("Cannot serialize rules with `"+t+"` for `options.rule`, expected `*`, `-`, or `_`");return t}function ob(e,t,n,r){let i=n.enter(`list`),a=n.bulletCurrent,o=e.ordered?ib(n):nb(n),s=e.ordered?o===`.`?`)`:`.`:rb(n),c=t&&n.bulletLastUsed?o===n.bulletLastUsed:!1;if(!e.ordered){let t=e.children?e.children[0]:void 0;if((o===`*`||o===`-`)&&t&&(!t.children||!t.children[0])&&n.stack[n.stack.length-1]===`list`&&n.stack[n.stack.length-2]===`listItem`&&n.stack[n.stack.length-3]===`list`&&n.stack[n.stack.length-4]===`listItem`&&n.indexStack[n.indexStack.length-1]===0&&n.indexStack[n.indexStack.length-2]===0&&n.indexStack[n.indexStack.length-3]===0&&(c=!0),ab(n)===o&&t){let t=-1;for(;++t<e.children.length;){let n=e.children[t];if(n&&n.type===`listItem`&&n.children&&n.children[0]&&n.children[0].type===`thematicBreak`){c=!0;break}}}}c&&(o=s),n.bulletCurrent=o;let l=n.containerFlow(e,r);return n.bulletLastUsed=o,n.bulletCurrent=a,i(),l}function sb(e){let t=e.options.listItemIndent||`one`;if(t!==`tab`&&t!==`one`&&t!==`mixed`)throw Error("Cannot serialize items with `"+t+"` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`");return t}function cb(e,t,n,r){let i=sb(n),a=n.bulletCurrent||nb(n);t&&t.type===`list`&&t.ordered&&(a=(typeof t.start==`number`&&t.start>-1?t.start:1)+(n.options.incrementListMarker===!1?0:t.children.indexOf(e))+a);let o=a.length+1;(i===`tab`||i===`mixed`&&(t&&t.type===`list`&&t.spread||e.spread))&&(o=Math.ceil(o/4)*4);let s=n.createTracker(r);s.move(a+` `.repeat(o-a.length)),s.shift(o);let c=n.enter(`listItem`),l=n.indentLines(n.containerFlow(e,s.current()),u);return c(),l;function u(e,t,n){return t?(n?``:` `.repeat(o))+e:(n?a:a+` `.repeat(o-a.length))+e}}function lb(e,t,n,r){let i=n.enter(`paragraph`),a=n.enter(`phrasing`),o=n.containerPhrasing(e,r);return a(),i(),o}var ub=__([`break`,`delete`,`emphasis`,`footnote`,`footnoteReference`,`image`,`imageReference`,`inlineCode`,`inlineMath`,`link`,`linkReference`,`mdxJsxTextElement`,`mdxTextExpression`,`strong`,`text`,`textDirective`]);function db(e,t,n,r){return(e.children.some(function(e){return ub(e)})?n.containerPhrasing:n.containerFlow).call(n,e,r)}function fb(e){let t=e.options.strong||`*`;if(t!==`*`&&t!==`_`)throw Error("Cannot serialize strong with `"+t+"` for `options.strong`, expected `*`, or `_`");return t}pb.peek=mb;function pb(e,t,n,r){let i=fb(n),a=n.enter(`strong`),o=n.createTracker(r),s=o.move(i+i),c=o.move(n.containerPhrasing(e,{after:i,before:s,...o.current()})),l=c.charCodeAt(0),u=Ry(r.before.charCodeAt(r.before.length-1),l,i);u.inside&&(c=Ly(l)+c.slice(1));let d=c.charCodeAt(c.length-1),f=Ry(r.after.charCodeAt(0),d,i);f.inside&&(c=c.slice(0,-1)+Ly(d));let p=o.move(i+i);return a(),n.attentionEncodeSurroundingInfo={after:f.outside,before:u.outside},s+c+p}function mb(e,t,n){return n.options.strong||`*`}function hb(e,t,n,r){return n.safe(e.value,r)}function gb(e){let t=e.options.ruleRepetition||3;if(t<3)throw Error("Cannot serialize rules with repetition `"+t+"` for `options.ruleRepetition`, expected `3` or more");return t}function _b(e,t,n){let r=(ab(n)+(n.options.ruleSpaces?` `:``)).repeat(gb(n));return n.options.ruleSpaces?r.slice(0,-1):r}var vb={blockquote:wy,break:Oy,code:My,definition:Fy,emphasis:zy,hardBreak:Oy,heading:Hy,html:Uy,image:Gy,imageReference:qy,inlineCode:Yy,link:Qy,linkReference:eb,list:ob,listItem:cb,paragraph:lb,root:db,strong:pb,text:hb,thematicBreak:_b};function yb(){return{enter:{table:bb,tableData:wb,tableHeader:wb,tableRow:Sb},exit:{codeText:Tb,table:xb,tableData:Cb,tableHeader:Cb,tableRow:Cb}}}function bb(e){let t=e._align;this.enter({type:`table`,align:t.map(function(e){return e===`none`?null:e}),children:[]},e),this.data.inTable=!0}function xb(e){this.exit(e),this.data.inTable=void 0}function Sb(e){this.enter({type:`tableRow`,children:[]},e)}function Cb(e){this.exit(e)}function wb(e){this.enter({type:`tableCell`,children:[]},e)}function Tb(e){let t=this.resume();this.data.inTable&&(t=t.replace(/\\([\\|])/g,Eb));let n=this.stack[this.stack.length-1];n.type,n.value=t,this.exit(e)}function Eb(e,t){return t===`|`?t:e}function Db(e){let t=e||{},n=t.tableCellPadding,r=t.tablePipeAlign,i=t.stringLength,a=n?` `:`|`;return{unsafe:[{character:`\r`,inConstruct:`tableCell`},{character:`
`,inConstruct:`tableCell`},{atBreak:!0,character:`|`,after:`[	 :-]`},{character:`|`,inConstruct:`tableCell`},{atBreak:!0,character:`:`,after:`-`},{atBreak:!0,character:`-`,after:`[:|-]`}],handlers:{inlineCode:f,table:o,tableCell:c,tableRow:s}};function o(e,t,n,r){return l(u(e,n,r),e.align)}function s(e,t,n,r){let i=l([d(e,n,r)]);return i.slice(0,i.indexOf(`
`))}function c(e,t,n,r){let i=n.enter(`tableCell`),o=n.enter(`phrasing`),s=n.containerPhrasing(e,{...r,before:a,after:a});return o(),i(),s}function l(e,t){return xy(e,{align:t,alignDelimiters:r,padding:n,stringLength:i})}function u(e,t,n){let r=e.children,i=-1,a=[],o=t.enter(`table`);for(;++i<r.length;)a[i]=d(r[i],t,n);return o(),a}function d(e,t,n){let r=e.children,i=-1,a=[],o=t.enter(`tableRow`);for(;++i<r.length;)a[i]=c(r[i],e,t,n);return o(),a}function f(e,t,n){let r=vb.inlineCode(e,t,n);return n.stack.includes(`tableCell`)&&(r=r.replace(/\|/g,`\\$&`)),r}}function Ob(){return{exit:{taskListCheckValueChecked:Ab,taskListCheckValueUnchecked:Ab,paragraph:jb}}}function kb(){return{unsafe:[{atBreak:!0,character:`-`,after:`[:|-]`}],handlers:{listItem:Mb}}}function Ab(e){let t=this.stack[this.stack.length-2];t.type,t.checked=e.type===`taskListCheckValueChecked`}function jb(e){let t=this.stack[this.stack.length-2];if(t&&t.type===`listItem`&&typeof t.checked==`boolean`){let e=this.stack[this.stack.length-1];e.type;let n=e.children[0];if(n&&n.type===`text`){let r=t.children,i=-1,a;for(;++i<r.length;){let e=r[i];if(e.type===`paragraph`){a=e;break}}a===e&&(n.value=n.value.slice(1),n.value.length===0?e.children.shift():e.position&&n.position&&typeof n.position.start.offset==`number`&&(n.position.start.column++,n.position.start.offset++,e.position.start=Object.assign({},n.position.start)))}}this.exit(e)}function Mb(e,t,n,r){let i=e.children[0],a=typeof e.checked==`boolean`&&i&&i.type===`paragraph`,o=`[`+(e.checked?`x`:` `)+`] `,s=n.createTracker(r);a&&s.move(o);let c=vb.listItem(e,t,n,{...r,...s.current()});return a&&(c=c.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/,l)),c;function l(e){return e+o}}function Nb(){return[zv(),ly(),my(),yb(),Ob()]}function Pb(e){return{extensions:[Bv(),uy(e),hy(),Db(e),kb()]}}var Fb={tokenize:Yb,partial:!0},Ib={tokenize:Xb,partial:!0},Lb={tokenize:Zb,partial:!0},Rb={tokenize:Qb,partial:!0},zb={tokenize:$b,partial:!0},Bb={name:`wwwAutolink`,tokenize:qb,previous:ex},Vb={name:`protocolAutolink`,tokenize:Jb,previous:tx},Hb={name:`emailAutolink`,tokenize:Kb,previous:nx},Ub={};function Wb(){return{text:Ub}}for(var Gb=48;Gb<123;)Ub[Gb]=Hb,Gb++,Gb===58?Gb=65:Gb===91&&(Gb=97);Ub[43]=Hb,Ub[45]=Hb,Ub[46]=Hb,Ub[95]=Hb,Ub[72]=[Hb,Vb],Ub[104]=[Hb,Vb],Ub[87]=[Hb,Bb],Ub[119]=[Hb,Bb];function Kb(e,t,n){let r=this,i,a;return o;function o(t){return!rx(t)||!nx.call(r,r.previous)||ix(r.events)?n(t):(e.enter(`literalAutolink`),e.enter(`literalAutolinkEmail`),s(t))}function s(t){return rx(t)?(e.consume(t),s):t===64?(e.consume(t),c):n(t)}function c(t){return t===46?e.check(zb,u,l)(t):t===45||t===95||Bp(t)?(a=!0,e.consume(t),c):u(t)}function l(t){return e.consume(t),i=!0,c}function u(o){return a&&i&&zp(r.previous)?(e.exit(`literalAutolinkEmail`),e.exit(`literalAutolink`),t(o)):n(o)}}function qb(e,t,n){let r=this;return i;function i(t){return t!==87&&t!==119||!ex.call(r,r.previous)||ix(r.events)?n(t):(e.enter(`literalAutolink`),e.enter(`literalAutolinkWww`),e.check(Fb,e.attempt(Ib,e.attempt(Lb,a),n),n)(t))}function a(n){return e.exit(`literalAutolinkWww`),e.exit(`literalAutolink`),t(n)}}function Jb(e,t,n){let r=this,i=``,a=!1;return o;function o(t){return(t===72||t===104)&&tx.call(r,r.previous)&&!ix(r.events)?(e.enter(`literalAutolink`),e.enter(`literalAutolinkHttp`),i+=String.fromCodePoint(t),e.consume(t),s):n(t)}function s(t){if(zp(t)&&i.length<5)return i+=String.fromCodePoint(t),e.consume(t),s;if(t===58){let n=i.toLowerCase();if(n===`http`||n===`https`)return e.consume(t),c}return n(t)}function c(t){return t===47?(e.consume(t),a?l:(a=!0,c)):n(t)}function l(t){return t===null||Hp(t)||Kp(t)||Jp(t)||qp(t)?n(t):e.attempt(Ib,e.attempt(Lb,u),n)(t)}function u(n){return e.exit(`literalAutolinkHttp`),e.exit(`literalAutolink`),t(n)}}function Yb(e,t,n){let r=0;return i;function i(t){return(t===87||t===119)&&r<3?(r++,e.consume(t),i):t===46&&r===3?(e.consume(t),a):n(t)}function a(e){return e===null?n(e):t(e)}}function Xb(e,t,n){let r,i,a;return o;function o(t){return t===46||t===95?e.check(Rb,c,s)(t):t===null||Kp(t)||Jp(t)||t!==45&&qp(t)?c(t):(a=!0,e.consume(t),o)}function s(t){return t===95?r=!0:(i=r,r=void 0),e.consume(t),o}function c(e){return i||r||!a?n(e):t(e)}}function Zb(e,t){let n=0,r=0;return i;function i(o){return o===40?(n++,e.consume(o),i):o===41&&r<n?a(o):o===33||o===34||o===38||o===39||o===41||o===42||o===44||o===46||o===58||o===59||o===60||o===63||o===93||o===95||o===126?e.check(Rb,t,a)(o):o===null||Kp(o)||Jp(o)?t(o):(e.consume(o),i)}function a(t){return t===41&&r++,e.consume(t),i}}function Qb(e,t,n){return r;function r(o){return o===33||o===34||o===39||o===41||o===42||o===44||o===46||o===58||o===59||o===63||o===95||o===126?(e.consume(o),r):o===38?(e.consume(o),a):o===93?(e.consume(o),i):o===60||o===null||Kp(o)||Jp(o)?t(o):n(o)}function i(e){return e===null||e===40||e===91||Kp(e)||Jp(e)?t(e):r(e)}function a(e){return zp(e)?o(e):n(e)}function o(t){return t===59?(e.consume(t),r):zp(t)?(e.consume(t),o):n(t)}}function $b(e,t,n){return r;function r(t){return e.consume(t),i}function i(e){return Bp(e)?n(e):t(e)}}function ex(e){return e===null||e===40||e===42||e===95||e===91||e===93||e===126||Kp(e)}function tx(e){return!zp(e)}function nx(e){return!(e===47||rx(e))}function rx(e){return e===43||e===45||e===46||e===95||Bp(e)}function ix(e){let t=e.length,n=!1;for(;t--;){let r=e[t][1];if((r.type===`labelLink`||r.type===`labelImage`)&&!r._balanced){n=!0;break}if(r._gfmAutolinkLiteralWalkedInto){n=!1;break}}return e.length>0&&!n&&(e[e.length-1][1]._gfmAutolinkLiteralWalkedInto=!0),n}var ax={tokenize:px,partial:!0};function ox(){return{document:{91:{name:`gfmFootnoteDefinition`,tokenize:ux,continuation:{tokenize:dx},exit:fx}},text:{91:{name:`gfmFootnoteCall`,tokenize:lx},93:{name:`gfmPotentialFootnoteCall`,add:`after`,tokenize:sx,resolveTo:cx}}}}function sx(e,t,n){let r=this,i=r.events.length,a=r.parser.gfmFootnotes||(r.parser.gfmFootnotes=[]),o;for(;i--;){let e=r.events[i][1];if(e.type===`labelImage`){o=e;break}if(e.type===`gfmFootnoteCall`||e.type===`labelLink`||e.type===`label`||e.type===`image`||e.type===`link`)break}return s;function s(i){if(!o||!o._balanced)return n(i);let s=Rp(r.sliceSerialize({start:o.end,end:r.now()}));return s.codePointAt(0)!==94||!a.includes(s.slice(1))?n(i):(e.enter(`gfmFootnoteCallLabelMarker`),e.consume(i),e.exit(`gfmFootnoteCallLabelMarker`),t(i))}}function cx(e,t){let n=e.length;for(;n--;)if(e[n][1].type===`labelImage`&&e[n][0]===`enter`){e[n][1];break}e[n+1][1].type=`data`,e[n+3][1].type=`gfmFootnoteCallLabelMarker`;let r={type:`gfmFootnoteCall`,start:Object.assign({},e[n+3][1].start),end:Object.assign({},e[e.length-1][1].end)},i={type:`gfmFootnoteCallMarker`,start:Object.assign({},e[n+3][1].end),end:Object.assign({},e[n+3][1].end)};i.end.column++,i.end.offset++,i.end._bufferIndex++;let a={type:`gfmFootnoteCallString`,start:Object.assign({},i.end),end:Object.assign({},e[e.length-1][1].start)},o={type:`chunkString`,contentType:`string`,start:Object.assign({},a.start),end:Object.assign({},a.end)},s=[e[n+1],e[n+2],[`enter`,r,t],e[n+3],e[n+4],[`enter`,i,t],[`exit`,i,t],[`enter`,a,t],[`enter`,o,t],[`exit`,o,t],[`exit`,a,t],e[e.length-2],e[e.length-1],[`exit`,r,t]];return e.splice(n,e.length-n+1,...s),e}function lx(e,t,n){let r=this,i=r.parser.gfmFootnotes||(r.parser.gfmFootnotes=[]),a=0,o;return s;function s(t){return e.enter(`gfmFootnoteCall`),e.enter(`gfmFootnoteCallLabelMarker`),e.consume(t),e.exit(`gfmFootnoteCallLabelMarker`),c}function c(t){return t===94?(e.enter(`gfmFootnoteCallMarker`),e.consume(t),e.exit(`gfmFootnoteCallMarker`),e.enter(`gfmFootnoteCallString`),e.enter(`chunkString`).contentType=`string`,l):n(t)}function l(s){if(a>999||s===93&&!o||s===null||s===91||Kp(s))return n(s);if(s===93){e.exit(`chunkString`);let a=e.exit(`gfmFootnoteCallString`);return i.includes(Rp(r.sliceSerialize(a)))?(e.enter(`gfmFootnoteCallLabelMarker`),e.consume(s),e.exit(`gfmFootnoteCallLabelMarker`),e.exit(`gfmFootnoteCall`),t):n(s)}return Kp(s)||(o=!0),a++,e.consume(s),s===92?u:l}function u(t){return t===91||t===92||t===93?(e.consume(t),a++,l):l(t)}}function ux(e,t,n){let r=this,i=r.parser.gfmFootnotes||(r.parser.gfmFootnotes=[]),a,o=0,s;return c;function c(t){return e.enter(`gfmFootnoteDefinition`)._container=!0,e.enter(`gfmFootnoteDefinitionLabel`),e.enter(`gfmFootnoteDefinitionLabelMarker`),e.consume(t),e.exit(`gfmFootnoteDefinitionLabelMarker`),l}function l(t){return t===94?(e.enter(`gfmFootnoteDefinitionMarker`),e.consume(t),e.exit(`gfmFootnoteDefinitionMarker`),e.enter(`gfmFootnoteDefinitionLabelString`),e.enter(`chunkString`).contentType=`string`,u):n(t)}function u(t){if(o>999||t===93&&!s||t===null||t===91||Kp(t))return n(t);if(t===93){e.exit(`chunkString`);let n=e.exit(`gfmFootnoteDefinitionLabelString`);return a=Rp(r.sliceSerialize(n)),e.enter(`gfmFootnoteDefinitionLabelMarker`),e.consume(t),e.exit(`gfmFootnoteDefinitionLabelMarker`),e.exit(`gfmFootnoteDefinitionLabel`),f}return Kp(t)||(s=!0),o++,e.consume(t),t===92?d:u}function d(t){return t===91||t===92||t===93?(e.consume(t),o++,u):u(t)}function f(t){return t===58?(e.enter(`definitionMarker`),e.consume(t),e.exit(`definitionMarker`),i.includes(a)||i.push(a),Zp(e,p,`gfmFootnoteDefinitionWhitespace`)):n(t)}function p(e){return t(e)}}function dx(e,t,n){return e.check(fm,t,e.attempt(ax,t,n))}function fx(e){e.exit(`gfmFootnoteDefinition`)}function px(e,t,n){let r=this;return Zp(e,i,`gfmFootnoteDefinitionIndent`,5);function i(e){let i=r.events[r.events.length-1];return i&&i[1].type===`gfmFootnoteDefinitionIndent`&&i[2].sliceSerialize(i[1],!0).length===4?t(e):n(e)}}function mx(e){let t=(e||{}).singleTilde,n={name:`strikethrough`,tokenize:i,resolveAll:r};return t??=!0,{text:{126:n},insideSpan:{null:[n]},attentionMarkers:{null:[126]}};function r(e,t){let n=-1;for(;++n<e.length;)if(e[n][0]===`enter`&&e[n][1].type===`strikethroughSequenceTemporary`&&e[n][1]._close){let r=n;for(;r--;)if(e[r][0]===`exit`&&e[r][1].type===`strikethroughSequenceTemporary`&&e[r][1]._open&&e[n][1].end.offset-e[n][1].start.offset===e[r][1].end.offset-e[r][1].start.offset){e[n][1].type=`strikethroughSequence`,e[r][1].type=`strikethroughSequence`;let i={type:`strikethrough`,start:Object.assign({},e[r][1].start),end:Object.assign({},e[n][1].end)},a={type:`strikethroughText`,start:Object.assign({},e[r][1].end),end:Object.assign({},e[n][1].start)},o=[[`enter`,i,t],[`enter`,e[r][1],t],[`exit`,e[r][1],t],[`enter`,a,t]],s=t.parser.constructs.insideSpan.null;s&&jp(o,o.length,0,am(s,e.slice(r+1,n),t)),jp(o,o.length,0,[[`exit`,a,t],[`enter`,e[n][1],t],[`exit`,e[n][1],t],[`exit`,i,t]]),jp(e,r-1,n-r+3,o),n=r+o.length-2;break}}for(n=-1;++n<e.length;)e[n][1].type===`strikethroughSequenceTemporary`&&(e[n][1].type=`data`);return e}function i(e,n,r){let i=this.previous,a=this.events,o=0;return s;function s(t){return i===126&&a[a.length-1][1].type!==`characterEscape`?r(t):(e.enter(`strikethroughSequenceTemporary`),c(t))}function c(a){let s=im(i);if(a===126)return o>1?r(a):(e.consume(a),o++,c);if(o<2&&!t)return r(a);let l=e.exit(`strikethroughSequenceTemporary`),u=im(a);return l._open=!u||u===2&&!!s,l._close=!s||s===2&&!!u,n(a)}}}var hx=class{constructor(){this.map=[]}add(e,t,n){gx(this,e,t,n)}consume(e){if(this.map.sort(function(e,t){return e[0]-t[0]}),this.map.length===0)return;let t=this.map.length,n=[];for(;t>0;)--t,n.push(e.slice(this.map[t][0]+this.map[t][1]),this.map[t][2]),e.length=this.map[t][0];n.push(e.slice()),e.length=0;let r=n.pop();for(;r;){for(let t of r)e.push(t);r=n.pop()}this.map.length=0}};function gx(e,t,n,r){let i=0;if(!(n===0&&r.length===0)){for(;i<e.map.length;){if(e.map[i][0]===t){e.map[i][1]+=n,e.map[i][2].push(...r);return}i+=1}e.map.push([t,n,r])}}function _x(e,t){let n=!1,r=[];for(;t<e.length;){let i=e[t];if(n){if(i[0]===`enter`)i[1].type===`tableContent`&&r.push(e[t+1][1].type===`tableDelimiterMarker`?`left`:`none`);else if(i[1].type===`tableContent`){if(e[t-1][1].type===`tableDelimiterMarker`){let e=r.length-1;r[e]=r[e]===`left`?`center`:`right`}}else if(i[1].type===`tableDelimiterRow`)break}else i[0]===`enter`&&i[1].type===`tableDelimiterRow`&&(n=!0);t+=1}return r}function vx(){return{flow:{null:{name:`table`,tokenize:yx,resolveAll:bx}}}}function yx(e,t,n){let r=this,i=0,a=0,o;return s;function s(e){let t=r.events.length-1;for(;t>-1;){let e=r.events[t][1].type;if(e===`lineEnding`||e===`linePrefix`)t--;else break}let i=t>-1?r.events[t][1].type:null,a=i===`tableHead`||i===`tableRow`?S:c;return a===S&&r.parser.lazy[r.now().line]?n(e):a(e)}function c(t){return e.enter(`tableHead`),e.enter(`tableRow`),l(t)}function l(e){return e===124?u(e):(o=!0,a+=1,u(e))}function u(t){return t===null?n(t):Q(t)?a>1?(a=0,r.interrupt=!0,e.exit(`tableRow`),e.enter(`lineEnding`),e.consume(t),e.exit(`lineEnding`),p):n(t):$(t)?Zp(e,u,`whitespace`)(t):(a+=1,o&&(o=!1,i+=1),t===124?(e.enter(`tableCellDivider`),e.consume(t),e.exit(`tableCellDivider`),o=!0,u):(e.enter(`data`),d(t)))}function d(t){return t===null||t===124||Kp(t)?(e.exit(`data`),u(t)):(e.consume(t),t===92?f:d)}function f(t){return t===92||t===124?(e.consume(t),d):d(t)}function p(t){return r.interrupt=!1,r.parser.lazy[r.now().line]?n(t):(e.enter(`tableDelimiterRow`),o=!1,$(t)?Zp(e,m,`linePrefix`,r.parser.constructs.disable.null.includes(`codeIndented`)?void 0:4)(t):m(t))}function m(t){return t===45||t===58?g(t):t===124?(o=!0,e.enter(`tableCellDivider`),e.consume(t),e.exit(`tableCellDivider`),h):x(t)}function h(t){return $(t)?Zp(e,g,`whitespace`)(t):g(t)}function g(t){return t===58?(a+=1,o=!0,e.enter(`tableDelimiterMarker`),e.consume(t),e.exit(`tableDelimiterMarker`),_):t===45?(a+=1,_(t)):t===null||Q(t)?b(t):x(t)}function _(t){return t===45?(e.enter(`tableDelimiterFiller`),v(t)):x(t)}function v(t){return t===45?(e.consume(t),v):t===58?(o=!0,e.exit(`tableDelimiterFiller`),e.enter(`tableDelimiterMarker`),e.consume(t),e.exit(`tableDelimiterMarker`),y):(e.exit(`tableDelimiterFiller`),y(t))}function y(t){return $(t)?Zp(e,b,`whitespace`)(t):b(t)}function b(n){return n===124?m(n):n===null||Q(n)?!o||i!==a?x(n):(e.exit(`tableDelimiterRow`),e.exit(`tableHead`),t(n)):x(n)}function x(e){return n(e)}function S(t){return e.enter(`tableRow`),C(t)}function C(n){return n===124?(e.enter(`tableCellDivider`),e.consume(n),e.exit(`tableCellDivider`),C):n===null||Q(n)?(e.exit(`tableRow`),t(n)):$(n)?Zp(e,C,`whitespace`)(n):(e.enter(`data`),w(n))}function w(t){return t===null||t===124||Kp(t)?(e.exit(`data`),C(t)):(e.consume(t),t===92?T:w)}function T(t){return t===92||t===124?(e.consume(t),w):w(t)}}function bx(e,t){let n=-1,r=!0,i=0,a=[0,0,0,0],o=[0,0,0,0],s=!1,c=0,l,u,d,f=new hx;for(;++n<e.length;){let p=e[n],m=p[1];p[0]===`enter`?m.type===`tableHead`?(s=!1,c!==0&&(Sx(f,t,c,l,u),u=void 0,c=0),l={type:`table`,start:Object.assign({},m.start),end:Object.assign({},m.end)},f.add(n,0,[[`enter`,l,t]])):m.type===`tableRow`||m.type===`tableDelimiterRow`?(r=!0,d=void 0,a=[0,0,0,0],o=[0,n+1,0,0],s&&(s=!1,u={type:`tableBody`,start:Object.assign({},m.start),end:Object.assign({},m.end)},f.add(n,0,[[`enter`,u,t]])),i=m.type===`tableDelimiterRow`?2:u?3:1):i&&(m.type===`data`||m.type===`tableDelimiterMarker`||m.type===`tableDelimiterFiller`)?(r=!1,o[2]===0&&(a[1]!==0&&(o[0]=o[1],d=xx(f,t,a,i,void 0,d),a=[0,0,0,0]),o[2]=n)):m.type===`tableCellDivider`&&(r?r=!1:(a[1]!==0&&(o[0]=o[1],d=xx(f,t,a,i,void 0,d)),a=o,o=[a[1],n,0,0])):m.type===`tableHead`?(s=!0,c=n):m.type===`tableRow`||m.type===`tableDelimiterRow`?(c=n,a[1]===0?o[1]!==0&&(d=xx(f,t,o,i,n,d)):(o[0]=o[1],d=xx(f,t,a,i,n,d)),i=0):i&&(m.type===`data`||m.type===`tableDelimiterMarker`||m.type===`tableDelimiterFiller`)&&(o[3]=n)}for(c!==0&&Sx(f,t,c,l,u),f.consume(t.events),n=-1;++n<t.events.length;){let e=t.events[n];e[0]===`enter`&&e[1].type===`table`&&(e[1]._align=_x(t.events,n))}return e}function xx(e,t,n,r,i,a){let o=r===1?`tableHeader`:r===2?`tableDelimiter`:`tableData`;n[0]!==0&&(a.end=Object.assign({},Cx(t.events,n[0])),e.add(n[0],0,[[`exit`,a,t]]));let s=Cx(t.events,n[1]);if(a={type:o,start:Object.assign({},s),end:Object.assign({},s)},e.add(n[1],0,[[`enter`,a,t]]),n[2]!==0){let i=Cx(t.events,n[2]),a=Cx(t.events,n[3]),o={type:`tableContent`,start:Object.assign({},i),end:Object.assign({},a)};if(e.add(n[2],0,[[`enter`,o,t]]),r!==2){let r=t.events[n[2]],i=t.events[n[3]];if(r[1].end=Object.assign({},i[1].end),r[1].type=`chunkText`,r[1].contentType=`text`,n[3]>n[2]+1){let t=n[2]+1,r=n[3]-n[2]-1;e.add(t,r,[])}}e.add(n[3]+1,0,[[`exit`,o,t]])}return i!==void 0&&(a.end=Object.assign({},Cx(t.events,i)),e.add(i,0,[[`exit`,a,t]]),a=void 0),a}function Sx(e,t,n,r,i){let a=[],o=Cx(t.events,n);i&&(i.end=Object.assign({},o),a.push([`exit`,i,t])),r.end=Object.assign({},o),a.push([`exit`,r,t]),e.add(n+1,0,a)}function Cx(e,t){let n=e[t],r=n[0]===`enter`?`start`:`end`;return n[1][r]}var wx={name:`tasklistCheck`,tokenize:Ex};function Tx(){return{text:{91:wx}}}function Ex(e,t,n){let r=this;return i;function i(t){return r.previous!==null||!r._gfmTasklistFirstContentOfListItem?n(t):(e.enter(`taskListCheck`),e.enter(`taskListCheckMarker`),e.consume(t),e.exit(`taskListCheckMarker`),a)}function a(t){return Kp(t)?(e.enter(`taskListCheckValueUnchecked`),e.consume(t),e.exit(`taskListCheckValueUnchecked`),o):t===88||t===120?(e.enter(`taskListCheckValueChecked`),e.consume(t),e.exit(`taskListCheckValueChecked`),o):n(t)}function o(t){return t===93?(e.enter(`taskListCheckMarker`),e.consume(t),e.exit(`taskListCheckMarker`),e.exit(`taskListCheck`),s):n(t)}function s(r){return Q(r)?t(r):$(r)?e.check({tokenize:Dx},t,n)(r):n(r)}}function Dx(e,t,n){return Zp(e,r,`whitespace`);function r(e){return e===null?n(e):t(e)}}function Ox(e){return Pp([Wb(),ox(),mx(e),vx(),Tx()])}var kx={};function Ax(e){let t=this,n=e||kx,r=t.data(),i=r.micromarkExtensions||=[],a=r.fromMarkdownExtensions||=[],o=r.toMarkdownExtensions||=[];i.push(Ox(n)),a.push(Nb()),o.push(Pb(n))}var jx=[{id:`agent-tools`,title:`Agent Tools`,sourcePath:`docs/agent-tools.md`,content:`# Agent Tools

Agent tools give a coding agent structured, operator-controlled access to the
local machine. Most tools are read-only; write-capable tools must be explicitly
configured by the operator and are constrained by \`safe_roots\` and per-tool
limits. Each tool is a named YAML entry under \`agent_tools.tools\` with a \`type\`
and a \`description\` that is shown to the LLM.

## Configuration skeleton

\`\`\`yaml
agent_tools:
  enabled: true
  max_iterations: 4          # max tool-call rounds per request (1–16)
  tool_timeout_seconds: 10   # per-tool timeout in seconds
  safe_roots:
    - /path/to/allowed/root  # all file-system tools must resolve under a safe root
  tools:
    my_tool_name:
      type: <tool_type>
      description: What this tool does (shown to the LLM).
      # ... type-specific fields
\`\`\`

---

## Tool Types

### \`shell\`

Run a fixed configured command and return stdout/stderr.

\`\`\`yaml
list_runtime_status:
  type: shell
  description: Print a short runtime status line.
  command: ["printf", "agent runtime ok"]
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`command\` | required | Command array passed to the subprocess directly (no shell). |
| \`timeout_seconds\` | \`tool_timeout_seconds\` | Override the global timeout for this tool. |

---

### \`file_read\`

Read a single configured file.

\`\`\`yaml
read_agent_note:
  type: file_read
  description: Read a local note file.
  path: ./logs/agent-note.txt
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | File to read. Must resolve under \`safe_roots\`. |

---

### \`file_read_dynamic\`

Read a file selected by the model under a configured root directory. The model
must pass a relative \`path\` argument; absolute paths and traversal outside the
configured root are rejected.

\`\`\`yaml
read_project_file:
  type: file_read_dynamic
  description: Read a project or log file by relative path.
  path: /Users/robertsmith/Apps/llama-pack
  max_file_bytes: 524288
\`\`\`

Example model arguments:

\`\`\`json
{"path":"logs/backend.log"}
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | Root directory for relative file reads. Must resolve under \`safe_roots\`. |
| \`max_file_bytes\` | \`524288\` | Reject files larger than this limit before reading. |

---

### \`file_write\`

Write, append, or create a single configured file. The model supplies only the
\`content\` argument; the destination path and write mode are fixed in YAML.

\`\`\`yaml
append_agent_note:
  type: file_write
  description: Append a note to the agent scratch log.
  path: ./logs/agent-notes.md
  write_mode: append
  max_write_bytes: 32768
\`\`\`

Model arguments:

\`\`\`json
{"content":"\\n- Checked node health.\\n"}
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | File to write. Must resolve under \`safe_roots\`. Parent directories are created if needed. |
| \`write_mode\` | \`append\` | \`append\`, \`write\`, or \`create_only\`. \`create_only\` fails if the file already exists. |
| \`max_write_bytes\` | \`32768\` | Reject content larger than this limit (1–1048576 bytes). |

---

### \`http\`

Call a fixed HTTP endpoint and return the raw response body as text.

\`\`\`yaml
local_health:
  type: http
  description: Check local health endpoint.
  method: GET
  url: http://127.0.0.1:9137/health
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`url\` | required | Fixed endpoint URL. |
| \`method\` | \`GET\` | \`GET\` or \`POST\`. |
| \`timeout_seconds\` | \`tool_timeout_seconds\` | Override the global timeout. |

---

### \`http_json\`

Call a fixed HTTP endpoint and return bounded parsed JSON. Returns a structured
error if the response is not valid JSON.

\`\`\`yaml
agent_health_json:
  type: http_json
  description: Check agent health and return structured JSON.
  method: GET
  url: http://127.0.0.1:9137/health
  max_response_bytes: 65536
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`url\` | required | Fixed endpoint URL. |
| \`method\` | \`GET\` | \`GET\` or \`POST\`. |
| \`max_response_bytes\` | \`65536\` | Truncate response body before parsing. |
| \`timeout_seconds\` | \`tool_timeout_seconds\` | Override the global timeout. |

---

### \`directory_list\`

List files and directories under a configured path without shelling out.

\`\`\`yaml
list_project_files:
  type: directory_list
  description: List top-level project structure.
  path: /Users/robertsmith/Apps/llama-pack
  recursive: true
  max_depth: 2
  max_entries: 200
  include_hidden: false
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | Directory to list. Must resolve under \`safe_roots\`. |
| \`recursive\` | \`false\` | Recurse into subdirectories. |
| \`max_depth\` | \`0\` | Max recursion depth when \`recursive: true\` (0–32). |
| \`max_entries\` | \`200\` | Max entries to return (1–5000). |
| \`include_hidden\` | \`false\` | Include dotfiles and hidden directories. |

---

### \`file_search\`

Search file names under a configured root by glob pattern. Safe equivalent of
\`find\` or \`rg --files\`.

\`\`\`yaml
find_python_files:
  type: file_search
  description: Find Python source files in the project.
  path: /Users/robertsmith/Apps/llama-pack
  glob: "**/*.py"
  max_entries: 200
  include_hidden: false
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | Root to search under. Must resolve under \`safe_roots\`. |
| \`glob\` | required | Glob pattern relative to \`path\`. |
| \`include_hidden\` | \`false\` | Include hidden files and directories. |
| \`max_entries\` | \`200\` | Max results to return (1–5000). |

---

### \`text_search\`

Search file contents under a configured root. Safe equivalent of bounded \`rg\`.

The agent provides a \`query\` argument at call time (defined via \`parameters\`).

\`\`\`yaml
search_project_code:
  type: text_search
  description: Search for text or symbols in project Python source files.
  path: /Users/robertsmith/Apps/llama-pack
  glob: "**/*.py"
  case_sensitive: false
  max_matches: 50
  max_file_bytes: 524288
  regex: true
  parameters:
    type: object
    properties:
      query:
        type: string
        description: The substring or regex pattern to search for.
    required: [query]
    additionalProperties: false
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | Root to search under. Must resolve under \`safe_roots\`. |
| \`glob\` | required | Glob pattern to filter which files to search. |
| \`case_sensitive\` | \`false\` | Case-sensitive matching. |
| \`regex\` | \`false\` | Treat \`query\` as a compiled regex instead of a substring. |
| \`max_matches\` | \`50\` | Max total matches to return (1–2000). |
| \`max_file_bytes\` | \`524288\` | Skip files larger than this (bytes). |

---

### \`git_status\`

Report read-only git state for a configured repository: current branch and
changed files.

\`\`\`yaml
repo_status:
  type: git_status
  description: Show current git branch and changed files.
  path: /Users/robertsmith/Apps/llama-pack
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | Repository root. Must resolve under \`safe_roots\`. |
| \`max_entries\` | \`200\` | Max changed files to return. |
| \`timeout_seconds\` | \`tool_timeout_seconds\` | Override the global timeout. |

---

### \`git_diff\`

Show the unstaged diff (\`git diff HEAD\`) for a configured repository, bounded
by \`max_lines\`.

\`\`\`yaml
repo_diff:
  type: git_diff
  description: Show unstaged changes in the project repo.
  path: /Users/robertsmith/Apps/llama-pack
  max_lines: 300
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | Repository root. Must resolve under \`safe_roots\`. |
| \`max_lines\` | \`100\` | Max diff lines to return (1–1000). |
| \`timeout_seconds\` | \`tool_timeout_seconds\` | Override the global timeout. |

---

### \`git_log\`

Show recent commit metadata for a configured repository.

\`\`\`yaml
repo_log:
  type: git_log
  description: Show recent commits in the project repo.
  path: /Users/robertsmith/Apps/llama-pack
  max_commits: 20
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | Repository root. Must resolve under \`safe_roots\`. |
| \`max_commits\` | \`20\` | Max commits to return (1–200). |
| \`timeout_seconds\` | \`tool_timeout_seconds\` | Override the global timeout. |

Returns \`hash\`, \`subject\`, \`author\`, and \`age\` for each commit.

---

### \`process_status\`

Report runtime health for locally managed model servers. Reads internal Llama
Manager process state — no shell commands.

\`\`\`yaml
model_health:
  type: process_status
  description: Report which model servers are running and on which ports.
  max_entries: 20
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`max_entries\` | \`200\` | Max processes to return (1–5000). |

Returns \`name\`, \`running\`, \`pid\`, \`port\`, and \`family\` for each process.

---

### \`log_tail\`

Return the last N lines of a configured log file without shelling out.

\`\`\`yaml
inference_log:
  type: log_tail
  description: Tail the most recent lines from the inference server log.
  path: logs/llama_pack_agent_uvicorn.log
  max_lines: 100
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | required | Log file to read. Must resolve under \`safe_roots\`. |
| \`max_lines\` | \`100\` | Max lines to return from the end of the file (1–1000). |

---

### \`sqlite_query\`

Run read-only SQL queries against one configured SQLite database, or against one
of several configured databases selected by stem name. Only queries whose first
non-comment token is \`SELECT\` or \`WITH\` are allowed, and connections open in
SQLite read-only mode.

Single database:

\`\`\`yaml
query_audit_db:
  type: sqlite_query
  description: Query audit event metadata.
  path: ./logs/audit_events.db
  max_entries: 100
\`\`\`

Multiple databases:

\`\`\`yaml
query_local_dbs:
  type: sqlite_query
  description: Query selected local SQLite stores.
  paths:
    - ./logs/auth_store.db
    - ./logs/audit_events.db
    - ./logs/chat_sessions.db
  max_entries: 100
\`\`\`

Model arguments:

\`\`\`json
{"db":"audit_events","query":"select id, event_type, created_at from audit_events limit 20"}
\`\`\`

For a single configured \`path\`, omit \`db\`:

\`\`\`json
{"query":"select count(*) as total from audit_events"}
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`path\` | optional | SQLite database file. Required unless \`paths\` is set. Must resolve under \`safe_roots\`. |
| \`paths\` | \`[]\` | Multiple SQLite database files. The model chooses one with \`db\`, using the file stem such as \`audit_events\`. |
| \`max_entries\` | \`200\` | Max rows to return (1–5000). |

---

### \`web_fetch\`

Fetch a URL and return the page content. The agent provides the \`url\` at call
time. HTML is stripped to readable text by default using BeautifulSoup.

\`\`\`yaml
browse_web:
  type: web_fetch
  description: Fetch and read a public web page.
  strip_html: true
  max_response_bytes: 131072
  # Optional: restrict to specific domains (and their subdomains).
  # If omitted, any public URL is allowed.
  allowed_domains:
    - stackoverflow.com
    - docs.python.org
    - github.com
    - pypi.org
  parameters:
    type: object
    properties:
      url:
        type: string
        description: The URL to fetch.
    required: [url]
    additionalProperties: false
\`\`\`

**Fields**

| Field | Default | Description |
|---|---|---|
| \`allowed_domains\` | \`[]\` (open) | If non-empty, only these domains and their subdomains are permitted. |
| \`strip_html\` | \`true\` | Strip HTML tags and extract visible text via BeautifulSoup. |
| \`max_response_bytes\` | \`65536\` | Truncate the response body before parsing (bytes). |
| \`timeout_seconds\` | \`tool_timeout_seconds\` | Override the global timeout. |

**Built-in SSRF protection** (always enforced, regardless of \`allowed_domains\`):
- Blocks \`localhost\`, \`0.0.0.0\`, \`::1\`
- Blocks RFC 1918 private ranges: \`10.x\`, \`172.16–31.x\`, \`192.168.x\`
- Blocks link-local: \`169.254.x\`, \`fe80::/10\`
- Only \`http\` and \`https\` schemes are allowed (\`file://\`, \`ftp://\`, etc. are rejected)

---

## Safety Rules

- All path-based local tools (\`file_read\`, \`file_read_dynamic\`, \`file_write\`,
  \`directory_list\`, \`file_search\`, \`text_search\`, \`git_status\`, \`git_diff\`,
  \`git_log\`, \`log_tail\`, and \`sqlite_query\`) require \`safe_roots\` to be set and
  will reject any path that does not resolve under a configured root.
- \`file_write\` is the only filesystem-mutating tool. It writes only to its
  configured \`path\`, enforces \`write_mode\`, and rejects content larger than
  \`max_write_bytes\`.
- \`sqlite_query\` opens databases read-only and accepts only \`SELECT\`/\`WITH\`
  queries after comments are stripped.
- \`http\` and \`http_json\` URLs are fixed in YAML; the agent cannot supply or
  modify URLs at call time.
- \`web_fetch\` blocks loopback, private IP ranges, and non-http(s) schemes at
  all times. Set \`allowed_domains\` to further restrict which public sites the
  agent can reach.
- \`process_status\` reads in-memory state only — no subprocess or filesystem
  access.
- Git tools are read-only status, diff, and log views. No commit, checkout, or
  push tools are implemented.

---

## Memory Tool Types

These tools interact with the controller's semantic memory store (ChromaDB +
\`all-MiniLM-L6-v2\`). They are only registered when the controller's memory
subsystem is enabled and the store is not disabled. See \`configuration.md\` for
the \`memory:\` config block.

---

### \`memory_write\`

Write an observation or fact into the controller's memory store. The write is
fire-and-forget — the tool returns immediately without waiting for the
embedding and storage to complete. Near-identical entries (cosine similarity
≥ 0.92) are deduplicated server-side.

\`\`\`yaml
save_user_note:
  type: memory_write
  description: Save a persistent note or observation about the user to memory.
\`\`\`

Model arguments at call time:

\`\`\`json
{
  "text": "User prefers dark mode and concise answers.",
  "tier": "durable",
  "topic": "preferences",
  "tags": ["ui", "style"]
}
\`\`\`

**Fields** (all optional in YAML — no static config beyond \`type\` and \`description\`)

| Argument | Default | Description |
|---|---|---|
| \`text\` | required | The fact or observation to store. Must be non-empty. |
| \`tier\` | \`durable\` | Memory tier: \`permanent\`, \`durable\`, or \`ephemeral\`. |
| \`topic\` | \`""\` | Optional topic label for grouping. |
| \`tags\` | \`[]\` | Optional list of tag strings. |

---

### \`memory_search\`

Search the controller's memory store by semantic similarity and return the
most relevant entries. The model provides the search query at call time.

\`\`\`yaml
recall_user_context:
  type: memory_search
  description: Search memory for facts about the user relevant to the current conversation.
  parameters:
    type: object
    properties:
      query:
        type: string
        description: What to search for in memory.
      top_k:
        type: integer
        description: Max results to return (1–20). Defaults to the store's configured top_k.
    required: [query]
    additionalProperties: false
\`\`\`

Model arguments at call time:

\`\`\`json
{"query": "user interface and workflow preferences", "top_k": 3}
\`\`\`

Returns:

\`\`\`json
{
  "ok": true,
  "count": 2,
  "results": [
    {"text": "User prefers dark mode.", "tier": "durable", "topic": "preferences", "tags": [], "score": 0.94, "id": "..."},
    {"text": "User uses a split-pane editor layout.", "tier": "ephemeral", "topic": "workflow", "tags": [], "score": 0.87, "id": "..."}
  ]
}
\`\`\`

**Fields**

| Argument | Default | Description |
|---|---|---|
| \`query\` | required | Natural language search query. Must be non-empty. |
| \`top_k\` | store \`top_k\` | Max results to return (1–20). |

---

## Tool-Loop Evaluations

Use \`scripts/tool_loop_eval.py\` to run deterministic tool-loop evaluations
against one or more local tool-capable models. The runner uses the same
agent-local tool execution path as \`/v1/chat/completions\` with
\`tool_runtime: "agent"\`, then writes an append-only JSONL history, a latest
summary JSON file, and durable benchmark history for UI/API consumption.

\`\`\`bash
rtk uv run python scripts/tool_loop_eval.py --config /path/to/controller-config.yaml --model gpt-oss-20b --target node:mac-mini
\`\`\`

Default output paths are:

- \`logs/tool_loop_eval_results.jsonl\`
- \`logs/tool_loop_eval_latest.json\`

The built-in cases use deterministic eval-only tools instead of the target
agent's configured tools. This keeps runs comparable across nodes and models.
Current synthetic presets cover:

- short and long ordered tool sequences
- avoiding unnecessary tool calls
- recovery after a deterministic tool error
- stopping after a tool reports that no more information is available
- branch selection
- exact tool argument preservation
- order-insensitive fact gathering
- helper/delegation-style synthesis

Current real-world deterministic scenarios ask models to draft compact design
documents from relevant project-like sources while avoiding unrelated scope.
UI/API-triggered runs also include a live workspace scenario that uses actual
workspace tools in a temporary seeded workspace and checks the generated
artifact content.

Run multiple models by repeating \`--model\`; route to a specific controller node
with \`--target node:<name>\`; run a single built-in case with \`--case <case-id>\`.
Node targets require a controller-mode config that defines the node. Running
the command with an agent-mode config will resolve the model as local to that
process instead of going through the controller. Runs started from the Tool
Loop Evals UI call \`/lm-api/v1/runtime/tool-loop-evals/run\` in agent mode or
\`/lm-api/v1/runtime/tool-loop-evals/node-run\` in controller mode, then persist
summaries and case details in the benchmark database.

See [Tool-Loop Eval Presets](tool-loop-eval-presets.md) for the preset roadmap
and scoring model.
`,headings:[{level:1,text:`Agent Tools`,anchor:`agent-tools`},{level:2,text:`Configuration skeleton`,anchor:`configuration-skeleton`},{level:2,text:`Tool Types`,anchor:`tool-types`},{level:3,text:"`shell`",anchor:`shell`},{level:3,text:"`file_read`",anchor:`file-read`},{level:3,text:"`file_read_dynamic`",anchor:`file-read-dynamic`},{level:3,text:"`file_write`",anchor:`file-write`},{level:3,text:"`http`",anchor:`http`},{level:3,text:"`http_json`",anchor:`http-json`},{level:3,text:"`directory_list`",anchor:`directory-list`},{level:3,text:"`file_search`",anchor:`file-search`},{level:3,text:"`text_search`",anchor:`text-search`},{level:3,text:"`git_status`",anchor:`git-status`},{level:3,text:"`git_diff`",anchor:`git-diff`},{level:3,text:"`git_log`",anchor:`git-log`},{level:3,text:"`process_status`",anchor:`process-status`},{level:3,text:"`log_tail`",anchor:`log-tail`},{level:3,text:"`sqlite_query`",anchor:`sqlite-query`},{level:3,text:"`web_fetch`",anchor:`web-fetch`},{level:2,text:`Safety Rules`,anchor:`safety-rules`},{level:2,text:`Memory Tool Types`,anchor:`memory-tool-types`},{level:3,text:"`memory_write`",anchor:`memory-write`},{level:3,text:"`memory_search`",anchor:`memory-search`},{level:2,text:`Tool-Loop Evaluations`,anchor:`tool-loop-evaluations`}],searchBody:`Agent Tools Agent tools give a coding agent structured, operator-controlled access to the local machine. Most tools are read-only; write-capable tools must be explicitly configured by the operator and are constrained by and per-tool limits. Each tool is a named YAML entry under with a and a that is shown to the LLM. Configuration skeleton --- Tool Types Run a fixed configured command and return stdout/stderr. Fields Field Default Description --- --- --- required Command array passed to the subprocess directly (no shell). Override the global timeout for this tool. --- Read a single configured file. Fields Field Default Description --- --- --- required File to read. Must resolve under . --- Read a file selected by the model under a configured root directory. The model must pass a relative argument; absolute paths and traversal outside the configured root are rejected. Example model arguments: Fields Field Default Description --- --- --- required Root directory for relative file reads. Must resolve under . Reject files larger than this limit before reading. --- Write, append, or create a single configured file. The model supplies only the argument; the destination path and write mode are fixed in YAML. Model arguments: Fields Field Default Description --- --- --- required File to write. Must resolve under . Parent directories are created if needed. , , or . fails if the file already exists. Reject content larger than this limit (1–1048576 bytes). --- Call a fixed HTTP endpoint and return the raw response body as text. Fields Field Default Description --- --- --- required Fixed endpoint URL. or . Override the global timeout. --- Call a fixed HTTP endpoint and return bounded parsed JSON. Returns a structured error if the response is not valid JSON. Fields Field Default Description --- --- --- required Fixed endpoint URL. or . Truncate response body before parsing. Override the global timeout. --- List files and directories under a configured path without shelling out. Fields Field Default Description --- --- --- required Directory to list. Must resolve under . Recurse into subdirectories. Max recursion depth when (0–32). Max entries to return (1–5000). Include dotfiles and hidden directories. --- Search file names under a configured root by glob pattern. Safe equivalent of or . Fields Field Default Description --- --- --- required Root to search under. Must resolve under . required Glob pattern relative to . Include hidden files and directories. Max results to return (1–5000). --- Search file contents under a configured root. Safe equivalent of bounded . The agent provides a argument at call time (defined via ). Fields Field Default Description --- --- --- required Root to search under. Must resolve under . required Glob pattern to filter which files to search. Case-sensitive matching. Treat as a compiled regex instead of a substring. Max total matches to return (1–2000). Skip files larger than this (bytes). --- Report read-only git state for a configured repository: current branch and changed files. Fields Field Default Description --- --- --- required Repository root. Must resolve under . Max changed files to return. Override the global timeout. --- Show the unstaged diff ( ) for a configured repository, bounded by . Fields Field Default Description --- --- --- required Repository root. Must resolve under . Max diff lines to return (1–1000). Override the global timeout. --- Show recent commit metadata for a configured repository. Fields Field Default Description --- --- --- required Repository root. Must resolve under . Max commits to return (1–200). Override the global timeout. Returns , , , and for each commit. --- Report runtime health for locally managed model servers. Reads internal Llama Manager process state — no shell commands. Fields Field Default Description --- --- --- Max processes to return (1–5000). Returns , , , , and for each process. --- Return the last N lines of a configured log file without shelling out. Fields Field Default Description --- --- --- required Log file to read. Must resolve under . Max lines to return from the end of the file (1–1000). --- Run read-only SQL queries against one configured SQLite database, or against one of several configured databases selected by stem name. Only queries whose first non-comment token is or are allowed, and connections open in SQLite read-only mode. Single database: Multiple databases: Model arguments: For a single configured , omit : Fields Field Default Description --- --- --- optional SQLite database file. Required unless is set. Must resolve under . Multiple SQLite database files. The model chooses one with , using the file stem such as . Max rows to return (1–5000). --- Fetch a URL and return the page content. The agent provides the at call time. HTML is stripped to readable text by default using BeautifulSoup. Fields Field Default Description --- --- --- (open) If non-empty, only these domains and their subdomains are permitted. Strip HTML tags and extract visible text via BeautifulSoup. Truncate the response body before parsing (bytes). Override the global timeout. Built-in SSRF protection (always enforced, regardless of ): - Blocks , , - Blocks RFC 1918 private ranges: , , - Blocks link-local: , - Only and schemes are allowed ( , , etc. are rejected) --- Safety Rules - All path-based local tools ( , , , , , , , , , , and ) require to be set and will reject any path that does not resolve under a configured root. - is the only filesystem-mutating tool. It writes only to its configured , enforces , and rejects content larger than . - opens databases read-only and accepts only / queries after comments are stripped. - and URLs are fixed in YAML; the agent cannot supply or modify URLs at call time. - blocks loopback, private IP ranges, and non-http(s) schemes at all times. Set to further restrict which public sites the agent can reach. - reads in-memory state only — no subprocess or filesystem access. - Git tools are read-only status, diff, and log views. No commit, checkout, or push tools are implemented. --- Memory Tool Types These tools interact with the controller's semantic memory store (ChromaDB + ). They are only registered when the controller's memory subsystem is enabled and the store is not disabled. See for the config block. --- Write an observation or fact into the controller's memory store. The write is fire-and-forget — the tool returns immediately without waiting for the embedding and storage to complete. Near-identical entries (cosine similarity ≥ 0.92) are deduplicated server-side. Model arguments at call time: Fields (all optional in YAML — no static config beyond and ) Argument Default Description --- --- --- required The fact or observation to store. Must be non-empty. Memory tier: , , or . Optional topic label for grouping. Optional list of tag strings. --- Search the controller's memory store by semantic similarity and return the most relevant entries. The model provides the search query at call time. Model arguments at call time: Returns: Fields Argument Default Description --- --- --- required Natural language search query. Must be non-empty. store Max results to return (1–20). --- Tool-Loop Evaluations Use to run deterministic tool-loop evaluations against one or more local tool-capable models. The runner uses the same agent-local tool execution path as with , then writes an append-only JSONL history, a latest summary JSON file, and durable benchmark history for UI/API consumption. Default output paths are: - - The built-in cases use deterministic eval-only tools instead of the target agent's configured tools. This keeps runs comparable across nodes and models. Current synthetic presets cover: - short and long ordered tool sequences - avoiding unnecessary tool calls - recovery after a deterministic tool error - stopping after a tool reports that no more information is available - branch selection - exact tool argument preservation - order-insensitive fact gathering - helper/delegation-style synthesis Current real-world deterministic scenarios ask models to draft compact design documents from relevant project-like sources while avoiding unrelated scope. UI/API-triggered runs also include a live workspace scenario that uses actual workspace tools in a temporary seeded workspace and checks the generated artifact content. Run multiple models by repeating ; route to a specific controller node with ; run a single built-in case with . Node targets require a controller-mode config that defines the node. Running the command with an agent-mode config will resolve the model as local to that process instead of going through the controller. Runs started from the Tool Loop Evals UI call in agent mode or in controller mode, then persist summaries and case details in the benchmark database. See Tool-Loop Eval Presets for the preset roadmap and scoring model.`},{id:`api`,title:`API`,sourcePath:`docs/api.md`,content:`# API

This page lists the main HTTP endpoints and documents the gateway surface for
applications that call Llama Pack as a private AI backend.

## External Chat Compatibility

Use an external app key with the OpenAI-compatible chat endpoint as the primary
integration surface for other apps. External app keys are chat-only credentials:
they can call the consumer completion APIs, but they cannot use admin,
operator, node, model, auth, audit, or settings endpoints.

\`\`\`bash
curl -X POST http://127.0.0.1:9137/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  -d '{
    "model": "qwen",
    "messages": [
      {"role": "user", "content": "Write a concise status update."}
    ],
    "request_type": "coding",
    "stream": false
  }'
\`\`\`

On a controller, \`request_type\` routes the call through
\`nodes.<name>.request_types\` using the same values as threaded chat, such as
\`general\`, \`coding\`, or \`research\`. Llama Pack creates a durable thread by
default and returns routing metadata in response headers:

\`\`\`text
X-Llama-Manager-Thread-Id: ...
X-Llama-Manager-Route: node:linux-2080ti
X-Llama-Manager-Node: linux-2080ti
X-Llama-Manager-Model: qwen
\`\`\`

Send \`thread_id\` on later calls to append to the same durable record and keep
thread affinity when the previous route is still eligible. The JSON response
body stays OpenAI-compatible.

Older Ollama clients can point at the compatibility route. The same external
app key boundary applies here:

\`\`\`bash
curl -X POST http://127.0.0.1:9137/api/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  -d '{
    "model": "qwen",
    "messages": [
      {"role": "user", "content": "Write a concise status update."}
    ],
    "request_type": "coding",
    "stream": false,
    "options": {
      "temperature": 0.2,
      "num_predict": 256
    }
  }'
\`\`\`

\`/api/chat\` preserves Ollama-style response bodies and streaming newline JSON,
while still using controller routing and the same metadata headers. Successful
external app calls write safe audit metadata, including key id, endpoint,
request type, routed node, and model. Prompt and response text are not written
to the audit event. The external app key list also stores a latest-use summary
for each key: last used time, endpoint, route, node, model, and request type.

## Client Discovery

Standalone clients should call \`GET /lm-api/v1/client-discovery\` before
presenting setup or login options. The endpoint is public so a client can detect
Llama Pack before it has credentials.

Example response:

\`\`\`json
{
  "product": "llama-pack",
  "version": "unknown",
  "mode": "controller",
  "capabilities": {
    "openaiChatCompletions": true,
    "streaming": true,
    "localChatSessions": false,
    "businessPlugin": false
  },
  "auth": {
    "methods": ["llama_pack_api_key", "external_api_key"],
    "sessionHeader": "X-UI-Session",
    "apiKeyHeader": "X-Llama-Manager-Key"
  },
  "endpoints": {
    "openaiChatCompletions": "/v1/chat/completions",
    "openaiModels": "/v1/models",
    "clientSession": "/v1/client/session",
    "clientChatDiagnostics": "/v1/client/diagnostics/chat",
    "models": "/lm-api/v1/models",
    "pluginsStatus": "/lm-api/v1/plugins/status",
    "docs": "/ui/docs"
  }
}
\`\`\`

When the private \`llama_pack_business\` plugin is enabled and healthy enough for
client login, discovery adds \`llama_pack_business\` to \`auth.methods\` and reports a
\`businessAuth\` endpoint. Clients should treat absent capability fields as
unsupported and should prefer \`/v1/chat/completions\` for end-user chat.

External chat-only keys can call:

- \`GET /v1/models\` to retrieve an end-user-safe model list.
- \`GET /v1/client/session\` to retrieve the current client's auth method, chat
  capabilities, and usable model list.
- \`POST /v1/client/diagnostics/chat\` to verify auth, route resolution, and
  non-streaming or streaming chat for setup flows.

These routes intentionally avoid admin/runtime details from \`/lm-api/v1/models\`.
For standalone end-user chat apps, prefer external app keys with the
\`X-Llama-Manager-Key\` header. Use UI sessions for the built-in operator/admin
UI. Plugin-provided auth modes should be discovered through client discovery and
handled by plugin-owned routes.

Example model list response:

\`\`\`json
{
  "object": "list",
  "data": [
    {
      "id": "qwen",
      "object": "model",
      "owned_by": "llama-pack",
      "metadata": {
        "display_label": "qwen",
        "request_types": ["coding"],
        "default_request_type": "coding",
        "context_identity": "qwen",
        "model_family": "qwen",
        "context_profile": null,
        "capabilities": {
          "streaming": true,
          "json_schema": false,
          "grammar": false,
          "vision": false
        }
      }
    }
  ]
}
\`\`\`

Example diagnostics request:

\`\`\`bash
curl -X POST http://127.0.0.1:9137/v1/client/diagnostics/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_EXTERNAL_APP_KEY" \\
  -d '{"model":"qwen","request_type":"coding","stream":false}'
\`\`\`

## Core Endpoints

- \`GET /health\`
- \`GET /client-discovery\`
- \`GET /models\`
- \`GET /models/profiles\`
- \`POST /models/profiles/activate\`
- \`POST /models/{name}/start\`
- \`POST /models/{name}/stop\`
- \`POST /models/{name}/restart\`
- \`POST /models/{name}/favorite\`
- \`GET /logs/{name}?lines=200\`
- \`GET /logs/{name}/stream?lines=200\`
- \`POST /chat/{name}\`
- \`POST /chat/{name}/stream\`
- \`POST /v1/chat/completions\`
- \`GET /v1/models\`
- \`GET /v1/client/session\`
- \`POST /v1/client/diagnostics/chat\`
- \`POST /api/chat\`
- \`GET /chat/capabilities/{name}\`
- \`POST /chat/{name}/inspect\`
- \`POST /chat/{name}/embeddings\`
- \`GET /chat/{name}/kv/slots?target=auto\`
- \`POST /chat/{name}/kv/slots/{slot_id}\`
- \`GET /chat/{name}/kv/capabilities?target=auto\`
- \`GET /chat/sessions\`
- \`GET /chat/sessions/{session_id}\`
- \`POST /chat/sessions\`
- \`DELETE /chat/sessions/{session_id}\`
- \`GET /library/ggufs\`
- \`POST /library/ggufs/{file_id}/add-model\`
- \`DELETE /library/ggufs/{file_id}\`
- \`DELETE /library/models/{name}\`
- \`GET /conversions/models\`
- \`POST /conversions/{name}/start\`
- \`GET /conversions/{name}\`
- \`GET /conversions/{name}/logs?lines=200\`
- \`GET /conversions/{name}/logs/stream?lines=200\`
- \`GET /downloads/models\`
- \`GET /downloads/history?status=completed&limit=100\`
- \`GET /downloads/quants?repo_id={repo_id}\`
- \`GET /downloads/recommendations\`
- \`GET /downloads/{repo_id}/quants\`
- \`POST /downloads/{repo_id}/start\`
- \`GET /downloads/{download_id}\`
- \`GET /downloads/{download_id}/logs?lines=200\`
- \`GET /downloads/{download_id}/logs/stream?lines=200\`
- \`POST /downloads/{download_id}/cancel\`
- \`DELETE /downloads/{download_id}\`
- \`GET /quantizations/files\`
- \`GET /quantizations/{file_id}\`
- \`POST /quantizations/{file_id}/start\`
- \`GET /quantizations/{file_id}/logs?lines=200\`
- \`GET /quantizations/{file_id}/logs/stream?lines=200\`
- \`GET /runtime/overview\`
- \`POST /runtime/route-preview\`
- \`GET /setup/status\`
- \`POST /setup/bootstrap-admin\`
- \`GET /setup/current-config\`
- \`POST /settings/api-keys/generate\`
- \`GET /audit/events\`
- \`POST /audit/events\`
- \`POST /auth/login\`
- \`GET /auth/me\`
- \`POST /auth/logout\`
- \`GET /auth/keys\`
- \`POST /auth/keys\`
- \`POST /auth/keys/{key_id}/revoke\`
- \`GET /external-keys\`
- \`POST /external-keys\`
- \`POST /external-keys/{key_id}/revoke\`
- \`GET /external-keys/{key_id}/analytics\`

### Setup assistant endpoints

The setup assistant endpoints live under \`/lm-api/v1/setup/*\` and support the
UI-first bootstrap flow described in [Setup](setup.md). They are intentionally
narrow: they report whether authentication still needs bootstrapping, create
the first admin key only when no auth exists, and expose a secret-masked config
snapshot for setup review.

**\`GET /setup/status\`** — Returns mode and bootstrap state:

\`\`\`json
{
  "mode": "controller",
  "auth_bootstrap_required": true,
  "auth_enabled": false,
  "setup_recommended": true,
  "models_count": 0,
  "has_nodes": false
}
\`\`\`

\`auth_bootstrap_required\` is false once either \`agent_api_key\` is configured or
the auth store has at least one active key.

**\`POST /setup/bootstrap-admin\`** — Creates the first admin key and an initial
UI session. This endpoint succeeds only when static auth is not configured and
the auth store has no active keys; later calls return \`409\`.

\`\`\`bash
curl -X POST http://127.0.0.1:9137/lm-api/v1/setup/bootstrap-admin \\
  -H "Content-Type: application/json" \\
  -d '{"username":"admin"}'
\`\`\`

Response:

\`\`\`json
{
  "token": "<ui-session-token>",
  "username": "admin",
  "expires_at": "2026-05-29T18:00:00+00:00",
  "role": "admin",
  "key": "<raw-admin-api-key>",
  "key_hint": "abcd...wxyz"
}
\`\`\`

The raw admin API key is returned once. The route also writes an
\`auth_bootstrap_admin_create\` audit event.

**\`GET /setup/current-config\`** — Returns a setup-oriented configuration
snapshot with secrets masked as \`***\`. It includes mode, log/config basics,
memory settings, nodes, agent/controller URLs, worker settings, model library
root, and the first configured model.

See [Model Downloads](downloads.md) for the download workflow, history, logs,
cancellation, and recommendations behavior.

## Controller Node Endpoints

- \`GET /nodes\`
- \`GET /nodes/status\`
- \`GET /nodes/models\`
- \`GET /nodes/models/profiles\`
- \`POST /nodes/register\`
- \`PUT /nodes/{node}\`
- \`POST /nodes/{node}/heartbeat\`
- \`POST /nodes/{node}/models/{name}/start\`
- \`POST /nodes/{node}/models/{name}/stop\`
- \`POST /nodes/{node}/models/{name}/restart\`
- \`GET /nodes/{node}/logs/{name}?lines=200\`
- \`GET /nodes/{node}/logs/{name}/stream?lines=200\`
- \`POST /nodes/{source}/transfers\`
- \`GET /transfers\`
- \`GET /transfers/{transfer_id}\`
- \`POST /transfer-source/grants\`
- \`GET /transfer-source/ggufs/{file_id}/manifest\`
- \`GET /transfer-source/files/{file_id}/content\`

The UI includes a Nodes page for controller mode that shows node reachability,
heartbeat/config metadata, reported models, and remote model
Start/Stop/Restart/Logs actions.

## Controller Orchestration Endpoints

Controller orchestration endpoints are available in controller mode only:

- \`POST /jobs\`
- \`GET /jobs\`
- \`GET /jobs/{job_id}\`
- \`POST /jobs/{job_id}/cancel\`
- \`GET /jobs/{job_id}/events\`
- \`GET /jobs/{job_id}/events/stream\`
- \`GET /jobs/{job_id}/artifacts\`
- \`GET /controller/stats\`
- \`GET /controller/retention-policy\`
- \`POST /controller/archive/export\`
- \`POST /nodes/{node}/work/claim\`
- \`POST /nodes/{node}/work/{attempt_id}/progress\`
- \`POST /nodes/{node}/work/{attempt_id}/complete\`
- \`POST /nodes/{node}/work/{attempt_id}/fail\`
- \`GET /benchmarks/definitions\`
- \`POST /benchmarks/definitions\`
- \`GET /benchmarks/runs\`
- \`GET /benchmarks/runs/{run_id}\`
- \`POST /benchmarks/runs\`
- \`POST /benchmarks/runs/compare\`

See [Benchmarks](benchmarks.md) for benchmark definitions, managed runs,
metrics, and comparison behavior.

### Job types

\`POST /jobs\` accepts a \`type\` field that determines how the agent worker
processes the job.

**\`llm.generate\`** — Single chat completion routed to one node.

\`\`\`json
{
  "type": "llm.generate",
  "payload": {
    "model": "qwen",
    "messages": [{"role": "user", "content": "Explain async/await."}],
    "target": "auto",
    "temperature": 0.7,
    "max_tokens": 512
  }
}
\`\`\`

**\`llm.embed\`** — Embed one or more strings via a model's embeddings endpoint.

\`\`\`json
{
  "type": "llm.embed",
  "payload": {
    "model": "nomic-embed",
    "input": ["sentence one", "sentence two"],
    "target": "auto"
  }
}
\`\`\`

**\`llm.batch\`** — Run a suite of prompt cases against a model, collecting
per-case outputs and a summary artifact. Each case can override \`model\`,
\`target\`, \`temperature\`, and \`max_tokens\`. Accepts 1–200 cases.

\`\`\`json
{
  "type": "llm.batch",
  "payload": {
    "model": "qwen",
    "target": "auto",
    "temperature": 0.7,
    "max_tokens": 512,
    "cases": [
      {"messages": [{"role": "user", "content": "Summarise X."}]},
      {
        "id": "hard-case",
        "messages": [{"role": "user", "content": "Explain Y in depth."}],
        "model": "llama",
        "max_tokens": 1024
      }
    ]
  }
}
\`\`\`

The completed job has one \`llm.batch.case\` artifact per case (with \`response\`,
\`elapsed_ms\`, and error if the case failed) and one \`llm.batch.summary\`
artifact. Cases that fail are recorded but do not abort the remaining cases.

**\`model.download\`** — Download a GGUF model repo or selected GGUF files from
Hugging Face on the target worker node. The agent uses its configured
\`hf_models_dirs\` destination and local Hugging Face credentials/environment.

\`\`\`json
{
  "type": "model.download",
  "target": "node:mac-agent",
  "payload": {
    "repo_id": "bartowski/Qwen2.5-7B-Instruct-GGUF",
    "revision": "main",
    "include_file": "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    "mmproj_file": null
  }
}
\`\`\`

\`repo_id\` must be in \`owner/name\` format. \`include_file\` and \`mmproj_file\` are
optional relative \`.gguf\` paths. Progress events include \`download_id\`,
\`bytes_downloaded\`, \`bytes_total\`, \`progress_percent\`, and \`local_path\`.
Cancelling the orchestration job cancels the local download process
cooperatively.

**\`model.install\`** — Download, verify, register, and optionally start a GGUF
model on the target worker node. This is the controller-to-agent workflow for
making a Hugging Face model usable on a specific agent.

\`\`\`json
{
  "type": "model.install",
  "target": "node:mac-agent",
  "payload": {
    "repo_id": "bartowski/Qwen2.5-7B-Instruct-GGUF",
    "revision": "main",
    "include_file": "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    "mmproj_file": null,
    "model_name": "qwen2.5-7b-q4",
    "port": 8080,
    "ctx": 4096,
    "gpu_layers": 0,
    "start": true
  }
}
\`\`\`

The worker emits progress stages for download progress, \`verified\`,
\`registered\`, and \`started\` when \`start\` is true. Registration uses the agent's
local model library configuration and persists config on agents that were
started from a writable config file.

**\`model.transfer\`** — Transfer a GGUF file from one registered node to another.

Most callers should start transfers through the controller helper endpoint
rather than posting \`model.transfer\` jobs directly. The helper validates both
nodes, asks the source node to create a one-time transfer grant, creates the
orchestration job, and targets it at the destination node's worker:

\`\`\`bash
curl -X POST http://127.0.0.1:9137/lm-api/v1/nodes/mac-mini/transfers \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  -d '{
    "destination_node": "linux-2080ti",
    "source_file_id": "<gguf-file-id>",
    "include": "selected_with_sidecars"
  }'
\`\`\`

The created job payload has this shape:

\`\`\`json
{
  "type": "model.transfer",
  "target": "node:linux-2080ti",
  "payload": {
    "source_node": "mac-mini",
    "destination_node": "linux-2080ti",
    "source_file_id": "<gguf-file-id>",
    "include": "selected_with_sidecars",
    "source_url": "http://mac-mini:9137",
    "transfer_token": "<generated-token>"
  }
}
\`\`\`

\`source_node\` and \`destination_node\` must differ. The only supported \`include\`
mode is \`selected_with_sidecars\`; the source manifest includes the selected
GGUF plus non-GGUF sidecars in the same model directory and any configured
\`mmproj\` file under the source model roots.

The destination worker fetches the source manifest, then fetches each file with
\`Authorization: Bearer <transfer_token>\`. Each destination write verifies file
size and SHA-256 before replacing the temporary file. Existing matching files
are skipped; conflicting existing files fail the job with
\`DESTINATION_CONFLICT\`.

Transfer helper and status endpoints:

- \`POST /nodes/{source}/transfers\` — Controller-only public entry point. Creates
  a source grant and a \`model.transfer\` job targeted at \`destination_node\`.
- \`GET /transfers\` — Lists recent \`model.transfer\` jobs as transfer summaries.
- \`GET /transfers/{transfer_id}\` — Returns one transfer summary, including
  \`files_total\`, \`files_copied\`, \`files_skipped\`, \`bytes_copied\`, \`copied\`,
  and \`skipped\` when available.

Source-agent transfer endpoints:

- \`POST /transfer-source/grants\` — Called by the controller on the source node.
  Creates an in-memory token grant for a source GGUF file and destination node.
- \`GET /transfer-source/ggufs/{file_id}/manifest\` — Called by the destination
  worker with the bearer token. Returns the source file manifest.
- \`GET /transfer-source/files/{file_id}/content\` — Called by the destination
  worker with the bearer token. Streams one allowed file from the source node.

The source-agent endpoints are not the normal public API for users. They are
protected by the generated transfer token in addition to normal Llama Pack API 
authentication, and grants are held in source-node memory.

## Thread Endpoints

Thread endpoints are available in controller mode. Threads maintain a durable
conversation history; each turn records user, routing, and assistant events.

- \`POST /lm-api/v1/threads\` — Create a thread.
- \`GET /lm-api/v1/threads/{id}/events\` — List events. Add \`?include_internal=true\` (admin only) to include routing decisions and workflow steps.
- \`POST /lm-api/v1/threads/{id}/messages\` — Post a user message and receive a routed assistant reply.
- \`POST /lm-api/v1/threads/{id}/messages/stream\` — Same, but streams the reply as SSE. The first event is \`{"type":"route","route":{...}}\` followed by token delta chunks.
- \`POST /lm-api/v1/threads/{id}/workflow\` — Run a multi-step workflow on the thread (see below).

### Workflow endpoint

\`POST /lm-api/v1/threads/{id}/workflow\` runs a linear chain of inference steps
where each step's output becomes the next step's input. Each step is routed
independently through the normal routing policy.

\`\`\`json
{
  "content": "The user's original input or seed text.",
  "steps": [
    {
      "label": "classify",
      "instructions": "Classify the request type. Reply with a single word.",
      "model": "qwen"
    },
    {
      "label": "generate",
      "instructions": "Generate a detailed response based on the classification.",
      "target": "node:gpu-box"
    },
    {
      "label": "summarize",
      "instructions": "Summarise the response in two sentences."
    }
  ],
  "model": "qwen",
  "target": "auto"
}
\`\`\`

Each step is an object with:

| Field | Default | Description |
|---|---|---|
| \`label\` | required | Display name for the step (recorded in events). |
| \`instructions\` | required | System-role message sent to the model for this step. |
| \`model\` | workflow \`model\` | Override the model for this step only. |
| \`target\` | workflow \`target\` | Override the routing target for this step only. |

Response:

\`\`\`json
{
  "thread_id": "...",
  "message": {"role": "assistant", "content": "<final step output>"},
  "route": {"node": "...", "model": "...", "strategy": "workflow", "reason": "workflow_final_step"},
  "workflow_steps": [
    {"label": "classify", "model": "qwen", "node": "linux-2080ti", "output": "..."},
    {"label": "generate", "model": "qwen", "node": "gpu-box", "output": "..."},
    {"label": "summarize", "model": "qwen", "node": "linux-2080ti", "output": "..."}
  ]
}
\`\`\`

Public thread events show only \`user_message\` and \`assistant_message\`. Internal
events include a \`workflow_step\` event pair (status \`running\` then \`complete\`)
for each step, plus a \`routing_decision\` event per step. If a step fails, a
\`workflow_step\` \`failed\` event and a public \`error\` event are appended and the
endpoint returns an error — steps that have not yet run are skipped.

## Memory Endpoints

Available on controller nodes when the memory subsystem is enabled
(\`memory.enabled: true\` in config). Both endpoints return \`503\` if the store
is disabled.

**\`POST /lm-api/v1/memory/write\`** — Write a memory entry. Accepts agent API
keys. Deduplication runs automatically: if a near-identical entry already
exists (cosine similarity ≥ 0.92) it is updated in place.

\`\`\`json
{
  "text": "User prefers concise answers with code examples.",
  "tier": "durable",
  "topic": "communication style",
  "tags": ["preferences", "style"]
}
\`\`\`

Response (\`201\`):
\`\`\`json
{"ok": true, "id": "<uuid>"}
\`\`\`

**\`POST /lm-api/v1/memory/search\`** — Semantic similarity search over stored
memories.

\`\`\`json
{"query": "user interface preferences", "top_k": 5}
\`\`\`

Response (\`200\`):
\`\`\`json
{
  "ok": true,
  "count": 2,
  "results": [
    {"text": "...", "tier": "durable", "topic": "...", "tags": [], "score": 0.94, "id": "..."}
  ]
}
\`\`\`
`,headings:[{level:1,text:`API`,anchor:`api`},{level:2,text:`External Chat Compatibility`,anchor:`external-chat-compatibility`},{level:2,text:`Client Discovery`,anchor:`client-discovery`},{level:2,text:`Core Endpoints`,anchor:`core-endpoints`},{level:3,text:`Setup assistant endpoints`,anchor:`setup-assistant-endpoints`},{level:2,text:`Controller Node Endpoints`,anchor:`controller-node-endpoints`},{level:2,text:`Controller Orchestration Endpoints`,anchor:`controller-orchestration-endpoints`},{level:3,text:`Job types`,anchor:`job-types`},{level:2,text:`Thread Endpoints`,anchor:`thread-endpoints`},{level:3,text:`Workflow endpoint`,anchor:`workflow-endpoint`},{level:2,text:`Memory Endpoints`,anchor:`memory-endpoints`}],searchBody:`API This page lists the main HTTP endpoints and documents the gateway surface for applications that call Llama Pack as a private AI backend. External Chat Compatibility Use an external app key with the OpenAI-compatible chat endpoint as the primary integration surface for other apps. External app keys are chat-only credentials: they can call the consumer completion APIs, but they cannot use admin, operator, node, model, auth, audit, or settings endpoints. On a controller, routes the call through using the same values as threaded chat, such as , , or . Llama Pack creates a durable thread by default and returns routing metadata in response headers: Send on later calls to append to the same durable record and keep thread affinity when the previous route is still eligible. The JSON response body stays OpenAI-compatible. Older Ollama clients can point at the compatibility route. The same external app key boundary applies here: preserves Ollama-style response bodies and streaming newline JSON, while still using controller routing and the same metadata headers. Successful external app calls write safe audit metadata, including key id, endpoint, request type, routed node, and model. Prompt and response text are not written to the audit event. The external app key list also stores a latest-use summary for each key: last used time, endpoint, route, node, model, and request type. Client Discovery Standalone clients should call before presenting setup or login options. The endpoint is public so a client can detect Llama Pack before it has credentials. Example response: When the private plugin is enabled and healthy enough for client login, discovery adds to and reports a endpoint. Clients should treat absent capability fields as unsupported and should prefer for end-user chat. External chat-only keys can call: - to retrieve an end-user-safe model list. - to retrieve the current client's auth method, chat capabilities, and usable model list. - to verify auth, route resolution, and non-streaming or streaming chat for setup flows. These routes intentionally avoid admin/runtime details from . For standalone end-user chat apps, prefer external app keys with the header. Use UI sessions for the built-in operator/admin UI. Plugin-provided auth modes should be discovered through client discovery and handled by plugin-owned routes. Example model list response: Example diagnostics request: Core Endpoints - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - Setup assistant endpoints The setup assistant endpoints live under and support the UI-first bootstrap flow described in Setup. They are intentionally narrow: they report whether authentication still needs bootstrapping, create the first admin key only when no auth exists, and expose a secret-masked config snapshot for setup review. — Returns mode and bootstrap state: is false once either is configured or the auth store has at least one active key. — Creates the first admin key and an initial UI session. This endpoint succeeds only when static auth is not configured and the auth store has no active keys; later calls return . Response: The raw admin API key is returned once. The route also writes an audit event. — Returns a setup-oriented configuration snapshot with secrets masked as . It includes mode, log/config basics, memory settings, nodes, agent/controller URLs, worker settings, model library root, and the first configured model. See Model Downloads for the download workflow, history, logs, cancellation, and recommendations behavior. Controller Node Endpoints - - - - - - - - - - - - - - - - - - The UI includes a Nodes page for controller mode that shows node reachability, heartbeat/config metadata, reported models, and remote model Start/Stop/Restart/Logs actions. Controller Orchestration Endpoints Controller orchestration endpoints are available in controller mode only: - - - - - - - - - - - - - - - - - - - - See Benchmarks for benchmark definitions, managed runs, metrics, and comparison behavior. Job types accepts a field that determines how the agent worker processes the job. — Single chat completion routed to one node. — Embed one or more strings via a model's embeddings endpoint. — Run a suite of prompt cases against a model, collecting per-case outputs and a summary artifact. Each case can override , , , and . Accepts 1–200 cases. The completed job has one artifact per case (with , , and error if the case failed) and one artifact. Cases that fail are recorded but do not abort the remaining cases. — Download a GGUF model repo or selected GGUF files from Hugging Face on the target worker node. The agent uses its configured destination and local Hugging Face credentials/environment. must be in format. and are optional relative paths. Progress events include , , , , and . Cancelling the orchestration job cancels the local download process cooperatively. — Download, verify, register, and optionally start a GGUF model on the target worker node. This is the controller-to-agent workflow for making a Hugging Face model usable on a specific agent. The worker emits progress stages for download progress, , , and when is true. Registration uses the agent's local model library configuration and persists config on agents that were started from a writable config file. — Transfer a GGUF file from one registered node to another. Most callers should start transfers through the controller helper endpoint rather than posting jobs directly. The helper validates both nodes, asks the source node to create a one-time transfer grant, creates the orchestration job, and targets it at the destination node's worker: The created job payload has this shape: and must differ. The only supported mode is ; the source manifest includes the selected GGUF plus non-GGUF sidecars in the same model directory and any configured file under the source model roots. The destination worker fetches the source manifest, then fetches each file with . Each destination write verifies file size and SHA-256 before replacing the temporary file. Existing matching files are skipped; conflicting existing files fail the job with . Transfer helper and status endpoints: - — Controller-only public entry point. Creates a source grant and a job targeted at . - — Lists recent jobs as transfer summaries. - — Returns one transfer summary, including , , , , , and when available. Source-agent transfer endpoints: - — Called by the controller on the source node. Creates an in-memory token grant for a source GGUF file and destination node. - — Called by the destination worker with the bearer token. Returns the source file manifest. - — Called by the destination worker with the bearer token. Streams one allowed file from the source node. The source-agent endpoints are not the normal public API for users. They are protected by the generated transfer token in addition to normal Llama Pack API authentication, and grants are held in source-node memory. Thread Endpoints Thread endpoints are available in controller mode. Threads maintain a durable conversation history; each turn records user, routing, and assistant events. - — Create a thread. - — List events. Add (admin only) to include routing decisions and workflow steps. - — Post a user message and receive a routed assistant reply. - — Same, but streams the reply as SSE. The first event is followed by token delta chunks. - — Run a multi-step workflow on the thread (see below). Workflow endpoint runs a linear chain of inference steps where each step's output becomes the next step's input. Each step is routed independently through the normal routing policy. Each step is an object with: Field Default Description --- --- --- required Display name for the step (recorded in events). required System-role message sent to the model for this step. workflow Override the model for this step only. workflow Override the routing target for this step only. Response: Public thread events show only and . Internal events include a event pair (status then ) for each step, plus a event per step. If a step fails, a event and a public event are appended and the endpoint returns an error — steps that have not yet run are skipped. Memory Endpoints Available on controller nodes when the memory subsystem is enabled ( in config). Both endpoints return if the store is disabled. — Write a memory entry. Accepts agent API keys. Deduplication runs automatically: if a near-identical entry already exists (cosine similarity ≥ 0.92) it is updated in place. Response ( ): — Semantic similarity search over stored memories. Response ( ):`},{id:`architecture`,title:`Architecture Overview`,sourcePath:`docs/architecture.md`,content:"# Architecture Overview\n\nLlama Pack is a secure local/private LLM gateway with an operations console.\nThe controller owns the gateway surface for apps and operators; agents own local\nmodel host work such as `llama-server` process lifecycle, model utilities, and\nfuture agent-runtime execution.\n\nThis repository is intentionally split into three layers so behavior is easier to reason about and review:\n\n- API layer (`llama_pack/api`): HTTP request/response translation and validation.\n- Core layer (`llama_pack/core`): domain logic for process management, chat routing, orchestration, and persistence workflows.\n- Provider/storage layer (`llama_pack/providers`, `llama_pack/storage`): external command composition and persistence primitives.\n\nAPI routes live under package-style modules in `llama_pack/api/routes`:\n\n- Single-resource routes use direct modules such as `routes.models`, `routes.library`, and `routes.health`.\n- Grouped surfaces use packages such as `routes.auth`, `routes.chat`, and `routes.nodes`.\n- Shared request/response helpers stay beside their route group, for example `routes.chat.common` and `routes.nodes.common`.\n\n## Runtime Modes\n\n`AppConfig.mode` controls deployment behavior:\n\n- `agent`: manages local `llama-server` processes, model utilities, and local runtime capabilities.\n- `controller`: tracks nodes, serves the private AI gateway, proxies operations, and manages durable job orchestration.\n\nBoth modes share the same codebase and routes; mode-specific routes enforce behavior at runtime.\n\n## Operational Scripts\n\n- `scripts/onboard_controller.sh`: creates or validates controller config, writes `.llama_pack.env`, runs migrations, creates the first admin API key, and prints the registration key for agents.\n- `scripts/onboard_agent.sh`: creates or validates agent config, writes `.llama_pack.env`, generates the agent API key, and prints the controller `nodes:` entry.\n- `scripts/start_agent.sh`, `scripts/start_controller.sh`, and `scripts/stop_server.sh`: source `.llama_pack.env` and manage local uvicorn processes.\n- `scripts/regenerate_key.sh`: rotates controller registration or agent API keys and prints the matching update for the other machines.\n\n## Request Flow (High-Level)\n\n1. `llama_pack/main.py` builds app state (config, managers, stores).\n2. Dependencies in `llama_pack/api/dependencies.py` inject shared services.\n3. Route handlers validate request shape and call core services.\n4. Core services own business rules and persistence writes.\n\n## Core Ownership Map\n\n- `core/config`: typed config models plus file/env loading and saving.\n- `core/runtime`: local process lifecycle and health payload construction.\n- `core/chat`: target resolution, transport building, capability inspection, and chat proxying.\n- `core/nodes`: controller node registry plus agent heartbeat and worker loops.\n- `core/plugins`: local-path plugin manifest loading, registration, events, policy hooks, route metadata, and plugin static asset ownership.\n- `core/model_assets`: GGUF library registration, HF conversion, and quantization workflows.\n- `core/orchestration`: durable job queue, attempts, events, contracts, retries, retention, archive export, and controller coordination.\n- `core/persistence`: focused SQLite-backed persistence for auth, chat sessions, and audit events.\n- `core/threads`: thread creation, append-only event log, routing policy, and multi-agent fanout/aggregation. See [multi-agent-routing.md](multi-agent-routing.md).\n\n## Testing Strategy\n\n- `tests/test_api.py`: broad route contracts, auth boundaries, setup assistant behavior, model/library operations, downloads, quantizations, node proxying, and compatibility routes.\n- `tests/test_config.py` and `tests/test_alembic_config.py`: config loading, split config files, environment expansion, defaults, save behavior, and migration target URL resolution.\n- `tests/test_process_manager.py`, `tests/test_runtime_overview.py`, and `tests/test_runtime_scripts.py`: local process lifecycle, runtime overview/route preview payloads, and helper script behavior.\n- `tests/test_orchestration_store.py`, `tests/test_execution_substrate.py`, `tests/test_orchestration_orm_models.py`, and `tests/test_persistence_dto.py`: durable jobs, attempts, events, worker contracts, DTO mapping, retries, cancellation, and terminal-state behavior.\n- `tests/test_thread_store.py`, `tests/test_threads_api.py`, and `tests/test_thread_routing_policy.py`: durable threads, event visibility, workflow execution, route decisions, affinity, startup decisions, and fanout routing.\n- `tests/test_agent_tools.py`: configured tool adapters, safe-root enforcement, bounded output, tool-loop behavior, memory tools, and write/query constraints.\n- `tests/test_downloads.py`, `tests/test_benchmark_api.py`, `tests/test_benchmark_store_orm.py`, `tests/test_model_transfers.py`, and `tests/test_model_transfer_smoke.py`: model asset downloads, benchmark definitions/runs, transfer manifests, transfer execution, and smoke-script coverage.\n- `tests/test_gguf_library.py`, `tests/test_conversions.py`, `tests/test_quantizations.py`, and `tests/test_model_transfers.py`: model library scanning, conversion/quantization workflows, sidecar handling, and model file movement.\n- `tests/test_agent_heartbeat.py`, `tests/test_node_registry.py`, `tests/test_linux_agent_smoke.py`, and `tests/test_routed_chat_compat_api.py`: node registration, heartbeat, controller routing, Linux agent smoke behavior, and external chat compatibility.\n- Persistence stores have focused ORM tests, including auth, audit, chat sessions, app state, benchmark, and database infrastructure coverage.\n- Frontend/static packaging is covered by `tests/test_frontend_tests.py`, `tests/test_ui_static_serving.py`, and `tests/test_package_data.py`, with React/Vite tests invoked through the Python suite.\n\n## Plugin Runtime\n\nPlugins are enabled through `enabled_plugins` and `plugins` config entries and\nare loaded from configured local paths. Plugin manifests can declare supported\nruntime modes with:\n\n```yaml\nmodes:\n  - controller\n```\n\nIf `modes` is omitted, the plugin is compatible with both `agent` and\n`controller`. If the current runtime mode is not listed, core leaves the plugin\ndisabled as incompatible and reports that state through\n`/lm-api/v1/plugins/status`.\n\nManifests may declare a small `config_schema` for plugin-local config values.\nCore validates configured values before importing and registering the plugin.\nInvalid config leaves the plugin disabled with a warning in\n`/lm-api/v1/plugins/status`, so plugin code does not run with missing required\nsettings. Schema fields can be marked `secret: true`; those values are still\npassed to the plugin through `PluginContext.get_plugin_config()` but are\nredacted in status metadata.\n\nPlugins can register health checks with `PluginContext.add_health_check()`.\nThe status endpoint runs enabled-plugin health checks dynamically, merges\nreturned warnings/errors into the status payload, and reports health-check\nexceptions as plugin health errors without failing the core status route.\n\nPlugins can register migration metadata with\n`PluginContext.add_migration_target()`. Core exposes the registered targets at\n`/lm-api/v1/plugins/{plugin_id}/migrations/status` and adds health warnings for\nmissing or pending plugin migrations. Core does not run plugin migrations during\nstartup; migration execution is explicit through the plugin migration API.\nPlugin-owned data should live in separate plugin databases under each plugin's\nstate directory. Core provides the database location and migration lifecycle\ncontract, but it does not import plugin models or mix plugin tables into core\ndatabases.\n\nFor plugin authoring details, see [Plugin Author Guide](plugins.md). For the\nplugin database boundary, see [Plugin Database Contract](plugin-databases.md).\n\n## Review Heuristics\n\nWhen reviewing changes, keep responsibilities narrow:\n\n- Route files should not contain domain branching that belongs in `core`.\n- Core modules should not perform implicit request parsing.\n- Persistence changes should include tests for retries, timeout handling, and terminal-state transitions.\n\nThis keeps complexity bounded and allows reviewers to evaluate behavior by layer.\n\n## Pull Request Rubric\n\nUse this checklist before opening or approving a PR:\n\n- Route vs Core boundary:\n  - Route modules should do validation, dependency wiring, and HTTP error mapping only.\n  - Business decisions, retries, and state transitions belong in `llama_pack/core`.\n- Error mapping:\n  - Upstream/network failures should be classified (`HTTP status` vs `transport`) and not collapsed into generic strings.\n  - Preserve stable response keys for UI and API consumers.\n- Status/result payload naming:\n  - Use consistent keys for lifecycle states (`status`, `completed_at`, `error_code`, `error_detail`, `result`).\n  - Avoid introducing synonymous fields for the same concept.\n- Abstraction threshold:\n  - Extract a helper when the same branching/payload logic appears in 2+ places.\n  - Keep helpers private unless reused across modules.\n- Test expectations:\n  - Add or update tests for state-transition changes, retry/timeout behavior, and error-shape contracts.\n  - Ensure full suite passes before merge.\n",headings:[{level:1,text:`Architecture Overview`,anchor:`architecture-overview`},{level:2,text:`Runtime Modes`,anchor:`runtime-modes`},{level:2,text:`Operational Scripts`,anchor:`operational-scripts`},{level:2,text:`Request Flow (High-Level)`,anchor:`request-flow-high-level`},{level:2,text:`Core Ownership Map`,anchor:`core-ownership-map`},{level:2,text:`Testing Strategy`,anchor:`testing-strategy`},{level:2,text:`Plugin Runtime`,anchor:`plugin-runtime`},{level:2,text:`Review Heuristics`,anchor:`review-heuristics`},{level:2,text:`Pull Request Rubric`,anchor:`pull-request-rubric`}],searchBody:`Architecture Overview Llama Pack is a secure local/private LLM gateway with an operations console. The controller owns the gateway surface for apps and operators; agents own local model host work such as process lifecycle, model utilities, and future agent-runtime execution. This repository is intentionally split into three layers so behavior is easier to reason about and review: - API layer ( ): HTTP request/response translation and validation. - Core layer ( ): domain logic for process management, chat routing, orchestration, and persistence workflows. - Provider/storage layer ( , ): external command composition and persistence primitives. API routes live under package-style modules in : - Single-resource routes use direct modules such as , , and . - Grouped surfaces use packages such as , , and . - Shared request/response helpers stay beside their route group, for example and . Runtime Modes controls deployment behavior: - : manages local processes, model utilities, and local runtime capabilities. - : tracks nodes, serves the private AI gateway, proxies operations, and manages durable job orchestration. Both modes share the same codebase and routes; mode-specific routes enforce behavior at runtime. Operational Scripts - : creates or validates controller config, writes , runs migrations, creates the first admin API key, and prints the registration key for agents. - : creates or validates agent config, writes , generates the agent API key, and prints the controller entry. - , , and : source and manage local uvicorn processes. - : rotates controller registration or agent API keys and prints the matching update for the other machines. Request Flow (High-Level) 1. builds app state (config, managers, stores). 2. Dependencies in inject shared services. 3. Route handlers validate request shape and call core services. 4. Core services own business rules and persistence writes. Core Ownership Map - : typed config models plus file/env loading and saving. - : local process lifecycle and health payload construction. - : target resolution, transport building, capability inspection, and chat proxying. - : controller node registry plus agent heartbeat and worker loops. - : local-path plugin manifest loading, registration, events, policy hooks, route metadata, and plugin static asset ownership. - : GGUF library registration, HF conversion, and quantization workflows. - : durable job queue, attempts, events, contracts, retries, retention, archive export, and controller coordination. - : focused SQLite-backed persistence for auth, chat sessions, and audit events. - : thread creation, append-only event log, routing policy, and multi-agent fanout/aggregation. See multi-agent-routing.md. Testing Strategy - : broad route contracts, auth boundaries, setup assistant behavior, model/library operations, downloads, quantizations, node proxying, and compatibility routes. - and : config loading, split config files, environment expansion, defaults, save behavior, and migration target URL resolution. - , , and : local process lifecycle, runtime overview/route preview payloads, and helper script behavior. - , , , and : durable jobs, attempts, events, worker contracts, DTO mapping, retries, cancellation, and terminal-state behavior. - , , and : durable threads, event visibility, workflow execution, route decisions, affinity, startup decisions, and fanout routing. - : configured tool adapters, safe-root enforcement, bounded output, tool-loop behavior, memory tools, and write/query constraints. - , , , , and : model asset downloads, benchmark definitions/runs, transfer manifests, transfer execution, and smoke-script coverage. - , , , and : model library scanning, conversion/quantization workflows, sidecar handling, and model file movement. - , , , and : node registration, heartbeat, controller routing, Linux agent smoke behavior, and external chat compatibility. - Persistence stores have focused ORM tests, including auth, audit, chat sessions, app state, benchmark, and database infrastructure coverage. - Frontend/static packaging is covered by , , and , with React/Vite tests invoked through the Python suite. Plugin Runtime Plugins are enabled through and config entries and are loaded from configured local paths. Plugin manifests can declare supported runtime modes with: If is omitted, the plugin is compatible with both and . If the current runtime mode is not listed, core leaves the plugin disabled as incompatible and reports that state through . Manifests may declare a small for plugin-local config values. Core validates configured values before importing and registering the plugin. Invalid config leaves the plugin disabled with a warning in , so plugin code does not run with missing required settings. Schema fields can be marked ; those values are still passed to the plugin through but are redacted in status metadata. Plugins can register health checks with . The status endpoint runs enabled-plugin health checks dynamically, merges returned warnings/errors into the status payload, and reports health-check exceptions as plugin health errors without failing the core status route. Plugins can register migration metadata with . Core exposes the registered targets at and adds health warnings for missing or pending plugin migrations. Core does not run plugin migrations during startup; migration execution is explicit through the plugin migration API. Plugin-owned data should live in separate plugin databases under each plugin's state directory. Core provides the database location and migration lifecycle contract, but it does not import plugin models or mix plugin tables into core databases. For plugin authoring details, see Plugin Author Guide. For the plugin database boundary, see Plugin Database Contract. Review Heuristics When reviewing changes, keep responsibilities narrow: - Route files should not contain domain branching that belongs in . - Core modules should not perform implicit request parsing. - Persistence changes should include tests for retries, timeout handling, and terminal-state transitions. This keeps complexity bounded and allows reviewers to evaluate behavior by layer. Pull Request Rubric Use this checklist before opening or approving a PR: - Route vs Core boundary: - Route modules should do validation, dependency wiring, and HTTP error mapping only. - Business decisions, retries, and state transitions belong in . - Error mapping: - Upstream/network failures should be classified ( vs ) and not collapsed into generic strings. - Preserve stable response keys for UI and API consumers. - Status/result payload naming: - Use consistent keys for lifecycle states ( , , , , ). - Avoid introducing synonymous fields for the same concept. - Abstraction threshold: - Extract a helper when the same branching/payload logic appears in 2+ places. - Keep helpers private unless reused across modules. - Test expectations: - Add or update tests for state-transition changes, retry/timeout behavior, and error-shape contracts. - Ensure full suite passes before merge.`},{id:`benchmarks`,title:`Benchmarks`,sourcePath:`docs/benchmarks.md`,content:`# Benchmarks

Benchmarks run repeatable chat prompts against configured models and store
per-sample latency, throughput, token, and response-excerpt telemetry. Benchmark
endpoints are available only in controller mode.

## Prerequisites

- Run the benchmarks migration before starting the controller:

\`\`\`bash
alembic -x db=benchmarks upgrade benchmarks@head
\`\`\`

- Configure controller routing and nodes so benchmark requests can reach the
  target model.
- For managed-load runs, the target node must be registered and reachable by
  the controller.

## Built-In Definitions

On startup, the benchmark store seeds a small preset suite:

- \`factual-qa-mini\`
- \`instruction-following-mini\`
- \`reasoning-math-mini\`
- \`summarization-mini\`

Legacy default definitions \`short-response-latency\` and
\`sustained-generation\` are archived automatically if present.

List active definitions:

\`\`\`bash
curl -s \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  http://127.0.0.1:9137/lm-api/v1/benchmarks/definitions
\`\`\`

Add \`?include_archived=true\` to include archived definitions.

## Creating Definitions

\`\`\`bash
curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  http://127.0.0.1:9137/lm-api/v1/benchmarks/definitions \\
  -d '{
    "name": "Coding Smoke",
    "slug": "coding-smoke",
    "description": "Small deterministic coding prompt.",
    "system_prompt": "Be concise.",
    "prompt_text": "Write a Python function that reverses a string.",
    "request_defaults": {"temperature": 0.0},
    "sample_count": 3,
    "max_tokens": 256,
    "tags": ["coding", "smoke"]
  }'
\`\`\`

Definition limits:

| Field | Limit |
|---|---|
| \`name\` | 1-120 characters |
| \`slug\` | lowercase alphanumeric words separated by hyphens |
| \`prompt_text\` | required |
| \`sample_count\` | 1-20 |
| \`max_tokens\` | 1-4096 |

If \`slug\` is omitted, it is derived from \`name\`.

## Starting Runs

Run one definition against one or more models:

\`\`\`bash
curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  http://127.0.0.1:9137/lm-api/v1/benchmarks/runs \\
  -d '{
    "definition_id": "<definition-id>",
    "models": ["qwen-coder:fast", "qwen-coder:long"],
    "target_selector": "auto"
  }'
\`\`\`

The API creates one run per model and schedules each run in the controller event
loop. Each run executes its samples sequentially. Multiple requested models can
run concurrently because each created run is scheduled independently.

Run statuses are:

| Status | Meaning |
|---|---|
| \`pending\` | Run was created and queued for execution. |
| \`running\` | Samples are executing. |
| \`completed\` | All samples succeeded. |
| \`partial\` | Some samples succeeded and some failed. |
| \`failed\` | No samples succeeded, or the run failed before sampling. |

## Managed Load

Managed-load runs isolate a model on one target node:

\`\`\`bash
curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  http://127.0.0.1:9137/lm-api/v1/benchmarks/runs \\
  -d '{
    "definition_id": "<definition-id>",
    "models": ["qwen-coder:long"],
    "managed_load": true,
    "target_node": "linux-2080ti",
    "restore_after": true
  }'
\`\`\`

When \`managed_load\` is true, \`target_node\` is required. The runner snapshots
currently running models on that node, stops them, starts the benchmark model,
waits up to the model start timeout, then runs samples with \`target_selector\`
set to \`node:<target_node>\`. If \`restore_after\` is true, it stops the benchmark
model and restarts the models that were running before the run.

## Results And Comparison

List recent runs:

\`\`\`bash
curl -s \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  "http://127.0.0.1:9137/lm-api/v1/benchmarks/runs?limit=50"
\`\`\`

Fetch a run and its samples:

\`\`\`bash
curl -s \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  http://127.0.0.1:9137/lm-api/v1/benchmarks/runs/<run-id>
\`\`\`

Run aggregates include:

- \`ttft_ms_median\`
- \`ttft_ms_p95\`
- \`tokens_per_second_median\`
- \`tokens_per_second_p95\`
- \`total_duration_ms_median\`
- \`success_rate\`
- \`sample_count\`

Each sample records status, TTFT, tokens per second, total duration, prompt and
completion token counts, completion character count, a 200-character response
excerpt, and any error detail.

Compare runs from the same definition:

\`\`\`bash
curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  http://127.0.0.1:9137/lm-api/v1/benchmarks/runs/compare \\
  -d '{"run_ids":["<run-a>","<run-b>"]}'
\`\`\`

Comparison requires at least two run IDs and rejects runs from different
benchmark definitions.

`,headings:[{level:1,text:`Benchmarks`,anchor:`benchmarks`},{level:2,text:`Prerequisites`,anchor:`prerequisites`},{level:2,text:`Built-In Definitions`,anchor:`built-in-definitions`},{level:2,text:`Creating Definitions`,anchor:`creating-definitions`},{level:2,text:`Starting Runs`,anchor:`starting-runs`},{level:2,text:`Managed Load`,anchor:`managed-load`},{level:2,text:`Results And Comparison`,anchor:`results-and-comparison`}],searchBody:`Benchmarks Benchmarks run repeatable chat prompts against configured models and store per-sample latency, throughput, token, and response-excerpt telemetry. Benchmark endpoints are available only in controller mode. Prerequisites - Run the benchmarks migration before starting the controller: - Configure controller routing and nodes so benchmark requests can reach the target model. - For managed-load runs, the target node must be registered and reachable by the controller. Built-In Definitions On startup, the benchmark store seeds a small preset suite: - - - - Legacy default definitions and are archived automatically if present. List active definitions: Add to include archived definitions. Creating Definitions Definition limits: Field Limit --- --- 1-120 characters lowercase alphanumeric words separated by hyphens required 1-20 1-4096 If is omitted, it is derived from . Starting Runs Run one definition against one or more models: The API creates one run per model and schedules each run in the controller event loop. Each run executes its samples sequentially. Multiple requested models can run concurrently because each created run is scheduled independently. Run statuses are: Status Meaning --- --- Run was created and queued for execution. Samples are executing. All samples succeeded. Some samples succeeded and some failed. No samples succeeded, or the run failed before sampling. Managed Load Managed-load runs isolate a model on one target node: When is true, is required. The runner snapshots currently running models on that node, stops them, starts the benchmark model, waits up to the model start timeout, then runs samples with set to . If is true, it stops the benchmark model and restarts the models that were running before the run. Results And Comparison List recent runs: Fetch a run and its samples: Run aggregates include: - - - - - - - Each sample records status, TTFT, tokens per second, total duration, prompt and completion token counts, completion character count, a 200-character response excerpt, and any error detail. Compare runs from the same definition: Comparison requires at least two run IDs and rejects runs from different benchmark definitions.`},{id:`caddy-local-tls-issues`,title:`Caddy Local TLS — Incidents & Troubleshooting Notes`,sourcePath:`docs/caddy-local-tls-issues.md`,content:`# Caddy Local TLS — Incidents & Troubleshooting Notes

Real-world issues encountered running the Llama Pack local TLS setup.
See [caddy-local-tls.md](caddy-local-tls.md) for the full setup and renewal
reference.

---

## 2026-06-06 — "500 errors on RPi" turned out to be an expired mac-mini cert

### Symptom

Internal \`httpx\` calls to model endpoints were returning 500 errors. Logs on
the Raspberry Pi controller showed messages like:

\`\`\`
TLS certificate verification failed: the certificate appears to be expired.
Re-issue and reinstall the Caddy certificate, then reload Caddy.
\`\`\`

### What we thought at first

Because the errors were appearing in the controller logs (running on the Pi),
the assumption was that the Pi's own certificate had expired and was causing the
failure.

### The real cause

The **controller's httpx calls proxy through to agent nodes**. When an agent
node's cert is expired, the controller is the one that throws the SSL error —
not the agent itself. The error surface is always the *requesting* side (the Pi
controller), even when the *responding* side (e.g. mac-mini) is the broken
node.

A quick check of all node cert expiries made the real culprit obvious:

\`\`\`bash
for h in pi-controller.local mac-mini.local linux-2080ti.local; do
  echo "=== $h ==="
  echo | openssl s_client -servername "$h" -connect "$h:443" 2>/dev/null \\
    | openssl x509 -noout -subject -dates
done
\`\`\`

Output:
\`\`\`
=== pi-controller.local ===
notBefore=Jun  6 22:10:55 2026 GMT
notAfter=Jun  7 22:11:55 2026 GMT       ← valid

=== mac-mini.local ===
notBefore=Jun  5 06:49:28 2026 GMT
notAfter=Jun  6 06:50:28 2026 GMT       ← EXPIRED

=== linux-2080ti.local ===
notBefore=Jun  6 20:20:34 2026 GMT
notAfter=Jun  7 20:21:34 2026 GMT       ← valid
\`\`\`

The mac-mini cert had been expired for ~10 hours.

### Why \`step ca renew\` won't work here

\`step ca renew\` only works while a cert is **still valid**. Once it has expired,
the command is blocked. You must re-issue from scratch using \`step ca
certificate ... --force\`.

### Fix

**Step 1 — Make sure \`step-ca\` is running on the Pi:**

\`\`\`bash
sudo systemctl start step-ca
sudo systemctl status step-ca
\`\`\`

**Step 2 — Re-issue the expired cert** (run on the mac-mini):

\`\`\`bash
step ca certificate mac-mini.local ~/llama-pack-certs/mac-mini.crt ~/llama-pack-certs/mac-mini.key \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/ca-root.crt \\
  --not-after 24h \\
  --force
\`\`\`

**Step 3 — Rebuild the fullchain and reload Caddy** (run on the mac-mini):

\`\`\`bash
cd /Users/robertsmith/Apps/llama-pack
scripts/renew_caddy_mac_mini.sh
\`\`\`

Wrapper script content (\`scripts/renew_caddy_mac_mini.sh\`):

\`\`\`bash
cd /Users/robertsmith/Apps/llama-pack
scripts/renew_caddy_step_cert.sh \\
  --name mac-mini \\
  --leaf ~/llama-pack-certs/mac-mini.crt \\
  --key ~/llama-pack-certs/mac-mini.key \\
  --intermediate ~/llama-pack-certs/intermediate_ca.crt \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/root_ca.crt \\
  --cert-dir /opt/homebrew/etc/caddy/certs \\
  --owner robertsmith \\
  --group staff \\
  --expires-in 24h \\
  --reload brew \\
  --force
\`\`\`

**Step 4 — Verify the renewed cert and full chain:**

\`\`\`bash
echo | openssl s_client -connect mac-mini.local:443 2>/dev/null | openssl x509 -noout -dates
echo | openssl s_client -connect mac-mini.local:443 2>/dev/null | grep -E "depth|verify"
\`\`\`

Expect \`depth=2\` (leaf + intermediate + root). If you see \`depth=0\`, the
fullchain was not installed — re-run Step 3.

---

## Key Lessons

### The error appears on the controller, not the broken node

When a controller-side \`httpx\` call fails with a TLS error, the node whose cert
is expired is the *target* of that call, not necessarily the machine the error
is logged on. Always check **all** nodes before assuming the controller itself
is the problem.

### Check every node's expiry first

Before any debugging, run the one-liner against all nodes:

\`\`\`bash
for h in pi-controller.local mac-mini.local linux-2080ti.local; do
  echo "=== $h ==="
  echo | openssl s_client -servername "$h" -connect "$h:443" 2>/dev/null \\
    | openssl x509 -noout -dates
done
\`\`\`

### Caddy must serve the fullchain, not the leaf cert

Serving only the leaf cert causes Python/httpx to fail with
\`unable to get local issuer certificate\` even when \`curl\` succeeds. Always use
\`*-fullchain.crt\` (leaf + intermediate concatenated) in the Caddyfile:

\`\`\`caddyfile
mac-mini.local {
    tls /opt/homebrew/etc/caddy/certs/mac-mini-fullchain.crt /opt/homebrew/etc/caddy/certs/mac-mini.key
    reverse_proxy 127.0.0.1:9137
}
\`\`\`

### 24h certs require twice-daily renewal

With \`--not-after 24h\` (or \`--expires-in 24h\`), the systemd timer on Pi/Linux
and the cron job on macOS must run at least twice a day. The
\`0 3,15 * * *\` schedule (3 AM and 3 PM) is the recommended interval. If a
machine is off during both windows, the cert will expire before the next
attempt.

If you move scheduling to \`launchd\` (recommended), copy the wrapper script to a
stable user path first:

\`\`\`bash
install -m 755 /Users/robertsmith/Apps/llama-pack/scripts/renew_caddy_mac_mini.sh \\
  /Users/robertsmith/bin/renew_caddy_mac_mini.sh
\`\`\`

Then point your LaunchAgent \`ProgramArguments\` to:
\`/Users/robertsmith/bin/renew_caddy_mac_mini.sh\`.
`,headings:[{level:1,text:`Caddy Local TLS — Incidents & Troubleshooting Notes`,anchor:`caddy-local-tls-incidents-troubleshooting-notes`},{level:2,text:`2026-06-06 — "500 errors on RPi" turned out to be an expired mac-mini cert`,anchor:`2026-06-06-500-errors-on-rpi-turned-out-to-be-an-expired-mac-mini-cert`},{level:3,text:`Symptom`,anchor:`symptom`},{level:3,text:`What we thought at first`,anchor:`what-we-thought-at-first`},{level:3,text:`The real cause`,anchor:`the-real-cause`},{level:3,text:"Why `step ca renew` won't work here",anchor:`why-step-ca-renew-wont-work-here`},{level:3,text:`Fix`,anchor:`fix`},{level:2,text:`Key Lessons`,anchor:`key-lessons`},{level:3,text:`The error appears on the controller, not the broken node`,anchor:`the-error-appears-on-the-controller-not-the-broken-node`},{level:3,text:`Check every node's expiry first`,anchor:`check-every-nodes-expiry-first`},{level:3,text:`Caddy must serve the fullchain, not the leaf cert`,anchor:`caddy-must-serve-the-fullchain-not-the-leaf-cert`},{level:3,text:`24h certs require twice-daily renewal`,anchor:`24h-certs-require-twice-daily-renewal`}],searchBody:`Caddy Local TLS — Incidents & Troubleshooting Notes Real-world issues encountered running the Llama Pack local TLS setup. See caddy-local-tls.md for the full setup and renewal reference. --- 2026-06-06 — "500 errors on RPi" turned out to be an expired mac-mini cert Symptom Internal calls to model endpoints were returning 500 errors. Logs on the Raspberry Pi controller showed messages like: What we thought at first Because the errors were appearing in the controller logs (running on the Pi), the assumption was that the Pi's own certificate had expired and was causing the failure. The real cause The controller's httpx calls proxy through to agent nodes. When an agent node's cert is expired, the controller is the one that throws the SSL error — not the agent itself. The error surface is always the requesting side (the Pi controller), even when the responding side (e.g. mac-mini) is the broken node. A quick check of all node cert expiries made the real culprit obvious: Output: The mac-mini cert had been expired for ~10 hours. Why won't work here only works while a cert is still valid. Once it has expired, the command is blocked. You must re-issue from scratch using . Fix Step 1 — Make sure is running on the Pi: Step 2 — Re-issue the expired cert (run on the mac-mini): Step 3 — Rebuild the fullchain and reload Caddy (run on the mac-mini): Wrapper script content ( ): Step 4 — Verify the renewed cert and full chain: Expect (leaf + intermediate + root). If you see , the fullchain was not installed — re-run Step 3. --- Key Lessons The error appears on the controller, not the broken node When a controller-side call fails with a TLS error, the node whose cert is expired is the target of that call, not necessarily the machine the error is logged on. Always check all nodes before assuming the controller itself is the problem. Check every node's expiry first Before any debugging, run the one-liner against all nodes: Caddy must serve the fullchain, not the leaf cert Serving only the leaf cert causes Python/httpx to fail with even when succeeds. Always use (leaf + intermediate concatenated) in the Caddyfile: 24h certs require twice-daily renewal With (or ), the systemd timer on Pi/Linux and the cron job on macOS must run at least twice a day. The schedule (3 AM and 3 PM) is the recommended interval. If a machine is off during both windows, the cert will expire before the next attempt. If you move scheduling to (recommended), copy the wrapper script to a stable user path first: Then point your LaunchAgent to: .`},{id:`caddy-local-tls`,title:`Caddy Local TLS Setup`,sourcePath:`docs/caddy-local-tls.md`,content:`# Caddy Local TLS Setup

This is the operator checklist for running Llama Pack controller and agent nodes
over local HTTPS with Caddy.

You can run Llama Pack without this TLS setup by exposing uvicorn directly on the
LAN:

\`\`\`bash
export LLAMA_PACK_HOST=0.0.0.0
export LLAMA_PACK_PORT=9137
\`\`\`

In that direct HTTP mode, controller and agent URLs use
\`http://<host>:9137\`. That is simpler, but API keys, prompts, responses, and
heartbeats travel in plaintext. For local TLS, change \`LLAMA_PACK_HOST\` to
\`127.0.0.1\`, use \`https://<host>.local\` URLs, and expose Caddy on \`443\`.

The target shape is:

\`\`\`text
other machines -> https://<node>.local:443 -> Caddy -> http://127.0.0.1:9137
\`\`\`

Llama Pack still uses API keys for authorization. Caddy adds transport
encryption and keeps uvicorn off the LAN.

## Hostnames

Use stable hostnames everywhere, not IP addresses:

| Role | Hostname |
| --- | --- |
| Controller | \`pi-controller.local\` |
| Mac agent | \`mac-mini.local\` |
| Linux agent | \`linux-2080ti.local\` |

The same hostname must be used in:

- \`/etc/hosts\`, mDNS, or LAN DNS
- the certificate DNS SAN
- the Caddy site block
- \`LLAMA_PACK_CONTROLLER_URL\`, \`LLAMA_PACK_AGENT_URL\`, and controller \`nodes:\`

After changing \`/etc/hosts\`, restart the affected Llama Pack process so long-lived
HTTP clients do not keep stale resolution behavior.

## Public Controller, Private Agents

For external user or mobile access, the best default topology is a public
controller domain with private agents reachable only over a VPN/private network.

\`\`\`text
public users/mobile apps
        |
        v
https://controller.example.com  ->  Caddy on controller  ->  127.0.0.1:9137
        |
        | controller-to-agent over VPN/private DNS
        v
https://linux-2080ti.tailnet-name.ts.net or https://linux-2080ti.internal
https://mac-mini.tailnet-name.ts.net or https://mac-mini.internal
\`\`\`

In this topology:

- The controller has a public DNS name and public HTTPS certificate, preferably
  from ACME/Let's Encrypt through Caddy.
- Agents stay off the public internet. Their Caddy listeners are reachable only
  from the controller over Tailscale, WireGuard, a private subnet, or a private
  DNS/VPN name.
- Public clients use only the controller URL.
- The controller \`nodes:\` URLs use the private/VPN agent names.
- Agents set \`LLAMA_PACK_CONTROLLER_URL\` to the public controller URL, because
  their heartbeat and work-claim traffic goes outbound to the controller.
- Agents set \`LLAMA_PACK_AGENT_URL\` to their private/VPN URL, because that is the
  URL the controller uses to call them.

Example controller \`.llama_pack.env\`:

\`\`\`bash
export LLAMA_PACK_HOST=127.0.0.1
export LLAMA_PACK_MAC_MINI_AGENT_URL=https://mac-mini.tailnet-name.ts.net
export LLAMA_PACK_LINUX_2080TI_AGENT_URL=https://linux-2080ti.tailnet-name.ts.net
\`\`\`

Example Mac agent \`.llama_pack.env\`:

\`\`\`bash
export LLAMA_PACK_HOST=127.0.0.1
export LLAMA_PACK_CONTROLLER_URL=https://controller.example.com
export LLAMA_PACK_AGENT_URL=https://mac-mini.tailnet-name.ts.net
\`\`\`

Example Linux agent \`.llama_pack.env\`:

\`\`\`bash
export LLAMA_PACK_HOST=127.0.0.1
export LLAMA_PACK_CONTROLLER_URL=https://controller.example.com
export LLAMA_PACK_AGENT_URL=https://linux-2080ti.tailnet-name.ts.net
\`\`\`

Controller Caddy with a public ACME cert can be as simple as:

\`\`\`caddyfile
controller.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:9137
}
\`\`\`

Agent Caddy can still use private CA certs, Tailscale HTTPS certs, or any
certificate trusted by the controller's Python runtime. If agent certs are
private CA certs, the controller must still set \`SSL_CERT_FILE\` and
\`REQUESTS_CA_BUNDLE\` to the private CA chain bundle.

Do not expose agent Caddy listeners publicly unless the controller cannot reach
them privately. Public agents increase the attack surface and require tighter
firewall, monitoring, and key-rotation discipline.

## Certificate Files

The CA root and intermediate cert are created by \`step ca init\` on the CA
machine. They are often under:

\`\`\`bash
~/.step/certs/root_ca.crt
~/.step/certs/intermediate_ca.crt
\`\`\`

If they are not there, ask Step where it keeps its files:

\`\`\`bash
step path
step context current
step context inspect
\`\`\`

Or search:

\`\`\`bash
find ~ -name 'root_ca.crt' -o -name 'intermediate_ca.crt'
\`\`\`

Copy both CA certs to every machine and keep a local staging copy:

\`\`\`bash
mkdir -p ~/llama-pack-certs
cp ~/.step/certs/root_ca.crt ~/llama-pack-certs/root_ca.crt
cp ~/.step/certs/intermediate_ca.crt ~/llama-pack-certs/intermediate_ca.crt
cat ~/llama-pack-certs/ca-root.crt ~/llama-pack-certs/intermediate_ca.crt \\
  > ~/llama-pack-certs/llama-pack-ca-chain.crt
\`\`\`

On other nodes, copy it with \`scp\` or another trusted transfer method:

\`\`\`bash
mkdir -p ~/llama-pack-certs
# copy root_ca.crt into ~/llama-pack-certs/ca-root.crt
# copy intermediate_ca.crt into ~/llama-pack-certs/intermediate_ca.crt
cat ~/llama-pack-certs/root_ca.crt ~/llama-pack-certs/intermediate_ca.crt \\
  > ~/llama-pack-certs/llama-pack-ca-chain.crt
\`\`\`

Install the root into system trust.

macOS:

\`\`\`bash
sudo security add-trusted-cert -d -r trustRoot \\
  -k /Library/Keychains/System.keychain \\
  ~/llama-pack-certs/ca-root.crt
\`\`\`

Debian, Ubuntu, and Raspberry Pi OS:

\`\`\`bash
sudo cp ~/llama-pack-certs/ca-root.crt /usr/local/share/ca-certificates/llama-pack-ca.crt
sudo update-ca-certificates
\`\`\`

System trust is not always enough for Python/httpx on every platform. Also
point Llama Pack at the CA chain bundle in each node's \`.llama_pack.env\`:

\`\`\`bash
export SSL_CERT_FILE=/home/rsmith/llama-pack-certs/llama-pack-ca-chain.crt
export REQUESTS_CA_BUNDLE=/home/rsmith/llama-pack-certs/llama-pack-ca-chain.crt
\`\`\`

Use the local account path on each machine. On the Mac mini, for example:

\`\`\`bash
export SSL_CERT_FILE=/Users/robertsmith/llama-pack-certs/llama-pack-ca-chain.crt
export REQUESTS_CA_BUNDLE=/Users/robertsmith/llama-pack-certs/llama-pack-ca-chain.crt
\`\`\`

## Issue Node Certificates

\`step-ca\` only needs to be running when issuing or renewing certificates.

Start it on the CA machine when needed:

\`\`\`bash
step-ca ~/.step/config/ca.json
\`\`\`

Issue each node certificate with the exact hostname clients will use.

Controller:

\`\`\`bash
step ca certificate pi-controller.local pi-controller.crt pi-controller.key \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/.step/certs/root_ca.crt \\
  --expires-in 24h
  --not-after 720h
\`\`\`

Mac agent:

\`\`\`bash
step ca certificate mac-mini.local mac-mini.crt mac-mini.key \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/ca-root.crt \\
  --not-after 720h
\`\`\`

Linux agent:

\`\`\`bash
step ca certificate linux-2080ti.local linux-2080ti.crt linux-2080ti.key \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/ca-root.crt \\
  --not-after 720h
\`\`\`

The \`--not-after 720h\` example gives 30-day certs if the CA policy allows it.
Shorter default certs work, but they need renewal sooner.

## Automatic Certificate Renewal

Smallstep certificates are often short-lived. For this Caddy setup, renewal has
three steps:

1. Renew the node leaf certificate with \`step ca renew\`.
2. Rebuild the Caddy fullchain by appending the intermediate CA certificate.
3. Reload Caddy so it serves the renewed certificate.

Use the repo helper for all three:

\`\`\`bash
scripts/renew_caddy_step_cert.sh \\
  --name pi-controller \\
  --leaf ~/llama-pack-certs/pi-controller.crt \\
  --key ~/llama-pack-certs/pi-controller.key \\
  --intermediate ~/.step/certs/intermediate_ca.crt \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/.step/certs/root_ca.crt \\
  --cert-dir /etc/caddy/certs \\
  --expires-in 24h \\
  --reload systemd \\
  --force
\`\`\`

For Linux agents, replace \`pi-controller\` with the agent basename, such as
\`linux-2080ti\`. For macOS Homebrew Caddy, use the Homebrew cert directory and
reload mode:

\`\`\`bash
scripts/renew_caddy_step_cert.sh \\
  --name mac-mini \\
  --leaf ~/llama-pack-certs/mac-mini.crt \\
  --key ~/llama-pack-certs/mac-mini.key \\
  --intermediate ~/llama-pack-certs/intermediate_ca.crt \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/ca-root.crt \\
  --cert-dir /opt/homebrew/etc/caddy/certs \\
  --owner robertsmith \\
  --group staff \\
  --expires-in 24h \\
  --reload brew
\`\`\`

Preview without changing anything:

\`\`\`bash
scripts/renew_caddy_step_cert.sh \\
  --name pi-controller \\
  --leaf ~/llama-pack-certs/pi-controller.crt \\
  --key ~/llama-pack-certs/pi-controller.key \\
  --intermediate ~/llama-pack-certs/intermediate_ca.crt \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/ca-root.crt \\
  --expires-in 24h \\
  --dry-run
\`\`\`

### Linux/Pi systemd timer

Copy the examples from \`deploy/caddy/\`:

\`\`\`bash
sudo cp deploy/caddy/renew-caddy-cert.service.example \\
  /etc/systemd/system/llama-pack-renew-caddy-cert.service
sudo cp deploy/caddy/renew-caddy-cert.timer.example \\
  /etc/systemd/system/llama-pack-renew-caddy-cert.timer
\`\`\`

Edit \`/etc/systemd/system/llama-pack-renew-caddy-cert.service\` for the local
node's paths, hostname, and cert basename. Then enable the timer:

\`\`\`bash
sudo systemctl daemon-reload
sudo systemctl enable --now llama-pack-renew-caddy-cert.timer
sudo systemctl list-timers | grep llama-pack-renew-caddy-cert
\`\`\`

Run once immediately:

\`\`\`bash
sudo systemctl start llama-pack-renew-caddy-cert.service
sudo journalctl -u llama-pack-renew-caddy-cert.service --no-pager -n 80
\`\`\`

The timer assumes \`step-ca\` is reachable when renewal runs. If the CA server is
not always running, either keep it available on the controller or schedule
renewal windows when it is running.

### macOS scheduled renewal

For Homebrew Caddy on macOS, use the dedicated wrapper:

\`\`\`bash
/Users/robertsmith/Apps/llama-pack/scripts/renew_caddy_mac_mini.sh
\`\`\`

For scheduled runs, prefer \`launchd\` over \`cron\`. Install the wrapper into a
stable user path and point your LaunchAgent to it:

\`\`\`bash
install -m 755 /Users/robertsmith/Apps/llama-pack/scripts/renew_caddy_mac_mini.sh \\
  /Users/robertsmith/bin/renew_caddy_mac_mini.sh
\`\`\`

LaunchAgent location:

\`\`\`text
~/Library/LaunchAgents/com.llama-pack.cert-renew.plist
\`\`\`

\`ProgramArguments\` should execute:

\`\`\`text
/Users/robertsmith/bin/renew_caddy_mac_mini.sh
\`\`\`

## Install Certs For Caddy

Caddy should serve a fullchain certificate: the node leaf certificate followed
by the intermediate CA certificate. Without the intermediate, \`curl\` may still
work in some environments while Python/httpx fails with
\`unable to get local issuer certificate\`.

Linux and Raspberry Pi:

\`\`\`bash
scripts/install_caddy_fullchain.sh \\
  --name pi-controller \\
  --leaf pi-controller.crt \\
  --key pi-controller.key \\
  --intermediate ~/llama-pack-certs/intermediate_ca.crt
\`\`\`

The script builds \`pi-controller-fullchain.crt\` from the user-writable leaf and
intermediate files, then uses \`sudo install\` to write:

- \`/etc/caddy/certs/pi-controller.crt\` with mode \`644\`
- \`/etc/caddy/certs/pi-controller-fullchain.crt\` with mode \`644\`
- \`/etc/caddy/certs/pi-controller.key\` with mode \`640\`
- \`/etc/caddy/certs/\` with owner \`root:caddy\` and mode \`750\`

Use \`--dry-run\` to preview the \`sudo install\` commands after building the local
fullchain. For \`linux-2080ti.local\`, replace \`pi-controller\` with
\`linux-2080ti\`.

macOS with Homebrew on Apple Silicon:

\`\`\`bash
sudo mkdir -p /opt/homebrew/etc/caddy/certs
sudo cp mac-mini.crt /opt/homebrew/etc/caddy/certs/mac-mini.crt
sudo cp mac-mini.key /opt/homebrew/etc/caddy/certs/mac-mini.key
cat mac-mini.crt ~/llama-pack-certs/intermediate_ca.crt > mac-mini-fullchain.crt
sudo cp mac-mini-fullchain.crt /opt/homebrew/etc/caddy/certs/mac-mini-fullchain.crt
sudo chown robertsmith:staff /opt/homebrew/etc/caddy/certs/mac-mini.key
sudo chmod 644 /opt/homebrew/etc/caddy/certs/mac-mini.crt
sudo chmod 644 /opt/homebrew/etc/caddy/certs/mac-mini-fullchain.crt
sudo chmod 600 /opt/homebrew/etc/caddy/certs/mac-mini.key
\`\`\`

Use \`brew --prefix\` to confirm \`/opt/homebrew\`. Intel Homebrew commonly uses
\`/usr/local\`.

## Caddyfiles

Linux and Raspberry Pi use \`/etc/caddy/Caddyfile\`.

Controller:

\`\`\`caddyfile
pi-controller.local {
    tls /etc/caddy/certs/pi-controller-fullchain.crt /etc/caddy/certs/pi-controller.key
    reverse_proxy 127.0.0.1:9137
}
\`\`\`

Linux agent:

\`\`\`caddyfile
linux-2080ti.local {
    tls /etc/caddy/certs/linux-2080ti-fullchain.crt /etc/caddy/certs/linux-2080ti.key
    reverse_proxy 127.0.0.1:9137
}
\`\`\`

macOS with Homebrew uses \`/opt/homebrew/etc/Caddyfile\` on Apple Silicon:

\`\`\`caddyfile
mac-mini.local {
    tls /opt/homebrew/etc/caddy/certs/mac-mini-fullchain.crt /opt/homebrew/etc/caddy/certs/mac-mini.key
    reverse_proxy 127.0.0.1:9137
}
\`\`\`

Repo templates are also available under \`deploy/caddy/\`.

## Run Caddy As A Service

Linux and Raspberry Pi:

\`\`\`bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
\`\`\`

After Caddyfile changes:

\`\`\`bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
\`\`\`

macOS Homebrew:

\`\`\`bash
caddy validate --config /opt/homebrew/etc/Caddyfile
brew services start caddy
brew services list | grep caddy
\`\`\`

If \`brew services\` reports an error, run this to expose the real failure:

\`\`\`bash
caddy run --config /opt/homebrew/etc/Caddyfile
\`\`\`

If the error says \`127.0.0.1:2019\` is already in use, another Caddy process is
already running. Stop the manual process, then restart the service:

\`\`\`bash
sudo pkill caddy
brew services restart caddy
\`\`\`

## Lock Down Llama Pack

Set uvicorn to loopback on every node:

\`\`\`bash
export LLAMA_PACK_HOST=127.0.0.1
\`\`\`

If using \`.llama_pack.env\`, add or update:

\`\`\`bash
export LLAMA_PACK_HOST=127.0.0.1
export LLAMA_PACK_PORT=9137
\`\`\`

Restart Llama Pack after changing \`.llama_pack.env\`:

\`\`\`bash
scripts/stop_server.sh
scripts/start_controller.sh   # controller machine
scripts/start_agent.sh        # agent machines
\`\`\`

## Switch Llama Pack URLs To HTTPS

Controller \`.llama_pack.env\`:

\`\`\`bash
export LLAMA_PACK_MAC_MINI_AGENT_URL=https://mac-mini.local
export LLAMA_PACK_LINUX_2080TI_AGENT_URL=https://linux-2080ti.local
export SSL_CERT_FILE=/home/rsmith/llama-pack-certs/llama-pack-ca-chain.crt
export REQUESTS_CA_BUNDLE=/home/rsmith/llama-pack-certs/llama-pack-ca-chain.crt
\`\`\`

Mac agent \`.llama_pack.env\`:

\`\`\`bash
export LLAMA_PACK_CONTROLLER_URL=https://pi-controller.local
export LLAMA_PACK_AGENT_URL=https://mac-mini.local
export SSL_CERT_FILE=/Users/robertsmith/llama-pack-certs/llama-pack-ca-chain.crt
export REQUESTS_CA_BUNDLE=/Users/robertsmith/llama-pack-certs/llama-pack-ca-chain.crt
\`\`\`

Linux agent \`.llama_pack.env\`:

\`\`\`bash
export LLAMA_PACK_CONTROLLER_URL=https://pi-controller.local
export LLAMA_PACK_AGENT_URL=https://linux-2080ti.local
export SSL_CERT_FILE=/home/llama-pack/llama-pack-certs/llama-pack-ca-chain.crt
export REQUESTS_CA_BUNDLE=/home/llama-pack/llama-pack-certs/llama-pack-ca-chain.crt
\`\`\`

Controller node config should use HTTPS and keep TLS verification enabled:

\`\`\`yaml
nodes:
  mac-mini:
    url: https://mac-mini.local
    api_key: \${LLAMA_PACK_MAC_MINI_AGENT_API_KEY}
    verify_tls: true
  linux-2080ti:
    url: https://linux-2080ti.local
    api_key: \${LLAMA_PACK_LINUX_2080TI_AGENT_API_KEY}
    verify_tls: true
\`\`\`

## Verification

Run from each machine:

\`\`\`bash
curl -v https://pi-controller.local/health
curl -v https://mac-mini.local/health
curl -v https://linux-2080ti.local/health
\`\`\`

The TLS output should include:

\`\`\`text
subjectAltName: host "<node>.local" matched
SSL certificate verify ok.
\`\`\`

Local uvicorn should still work on the node itself:

\`\`\`bash
curl -v http://127.0.0.1:9137/health
\`\`\`

Direct remote uvicorn access should fail:

\`\`\`bash
curl -v http://mac-mini.local:9137/health
curl -v http://pi-controller.local:9137/health
curl -v http://linux-2080ti.local:9137/health
\`\`\`

Controller node visibility:

\`\`\`bash
curl -s -H "X-Llama-Manager-Key: $LLAMA_PACK_CONTROLLER_ADMIN_API_KEY" \\
  https://pi-controller.local/lm-api/v1/nodes
\`\`\`

Python/httpx trust from each node:

\`\`\`bash
SSL_CERT_FILE=$HOME/llama-pack-certs/llama-pack-ca-chain.crt python3 - <<'PY'
import urllib.request
for url in [
    "https://pi-controller.local/health",
    "https://mac-mini.local/health",
    "https://linux-2080ti.local/health",
]:
    print(url, urllib.request.urlopen(url, timeout=5).read())
PY
\`\`\`

Heartbeats flow from each agent to the controller. If \`/ui/nodes\` shows stale
heartbeats, test the controller URL from the agent process environment first:

\`\`\`bash
SSL_CERT_FILE=$HOME/llama-pack-certs/llama-pack-ca-chain.crt python3 - <<'PY'
import urllib.request
print(urllib.request.urlopen("https://pi-controller.local/health", timeout=5).read())
PY
\`\`\`

The controller also calls agents for \`/ui/nodes\` model/status data, so the
controller's Python environment must trust the same CA chain.

## Recovering From Expired Certificates

\`step ca renew\` only works while the cert is still valid. If a cert has already
expired, renew is blocked and you must re-issue from scratch.

**Step 1 — Make sure \`step-ca\` is running on the Pi:**

\`\`\`bash
sudo systemctl start step-ca
sudo systemctl status step-ca
\`\`\`

**Step 2 — Re-issue the cert on each node** (run on the machine that owns the cert):

Pi controller:
\`\`\`bash
step ca certificate pi-controller.local ~/llama-pack-certs/pi-controller.crt ~/llama-pack-certs/pi-controller.key \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/.step/certs/root_ca.crt \\
  --not-after 24h \\
  --force
\`\`\`

Mac mini:
\`\`\`bash
step ca certificate mac-mini.local ~/llama-pack-certs/mac-mini.crt ~/llama-pack-certs/mac-mini.key \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/ca-root.crt \\
  --not-after 24h \\
  --force
\`\`\`

Linux agent:
\`\`\`bash
step ca certificate linux-2080ti.local ~/llama-pack-certs/linux-2080ti.crt ~/llama-pack-certs/linux-2080ti.key \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/ca-root.crt \\
  --not-after 24h \\
  --force
\`\`\`

The \`--not-after\` duration must be within the CA policy limit. If the CA rejects
longer durations (e.g. 720h), use \`24h\`. With a 24h cert lifetime, cron must run
at least twice a day to stay ahead of expiry — the \`0 3,15 * * *\` schedule works.

**Step 3 — Install and reload Caddy** using the renewal script with \`--force\`:

\`\`\`bash
scripts/renew_caddy_step_cert.sh \\
  --name <node> \\
  --leaf ~/llama-pack-certs/<node>.crt \\
  --key ~/llama-pack-certs/<node>.key \\
  --intermediate ~/llama-pack-certs/intermediate_ca.crt \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/ca-root.crt \\
  --expires-in 24h \\
  --force \\
  [--cert-dir /etc/caddy/certs --reload systemd]      # Pi / Linux
  [--cert-dir /opt/homebrew/etc/caddy/certs --owner robertsmith --group staff --reload brew]  # Mac
\`\`\`

## Running step-ca As A Systemd Service

\`step-ca\` does not create a systemd service automatically. Without it, the CA
goes down on reboot and all renewal cron jobs fail.

Create the service file on the Pi:

\`\`\`bash
sudo nano /etc/systemd/system/step-ca.service
\`\`\`

\`\`\`ini
[Unit]
Description=Smallstep step-ca Certificate Authority
After=network.target

[Service]
Type=simple
User=rsmith
ExecStart=/usr/bin/step-ca /home/rsmith/.step/config/ca.json --password-file /etc/step-ca/password.txt
Restart=on-failure
RestartSec=10
Environment=STEPPATH=/home/rsmith/.step

[Install]
WantedBy=multi-user.target
\`\`\`

Replace \`rsmith\` with the actual username. Find the \`step-ca\` binary path with
\`which step-ca\` if it is not at \`/usr/bin/step-ca\`.

The \`--password-file\` flag is required. Without it, \`step-ca\` tries to prompt
for the key password interactively and fails with
\`open /dev/tty: no such device or address\` when run as a service.

Create the password file:

\`\`\`bash
sudo mkdir -p /etc/step-ca
echo "your-ca-password" | sudo tee /etc/step-ca/password.txt
sudo chmod 600 /etc/step-ca/password.txt
sudo chown rsmith:rsmith /etc/step-ca/password.txt
\`\`\`

Enable and start:

\`\`\`bash
sudo systemctl daemon-reload
sudo systemctl enable --now step-ca
sudo systemctl status step-ca
\`\`\`

Verify the CA is reachable:

\`\`\`bash
step ca health --ca-url https://pi-controller.local:8443 --root ~/llama-pack-certs/ca-root.crt
\`\`\`

## Verifying Renewal Is Working

**Mac — check the cron log:**

\`\`\`bash
cat ~/Library/Logs/llama-pack-renew-caddy-cert.log
\`\`\`

**Pi and Linux — check the systemd timer and service:**

\`\`\`bash
sudo systemctl list-timers | grep llama-pack
sudo journalctl -u llama-pack-renew-caddy-cert.service --no-pager -n 30
\`\`\`

**Force a test run on any machine** to confirm the full pipeline end-to-end:

Mac:
\`\`\`bash
cd /Users/robertsmith/Apps/llama-pack && scripts/renew_caddy_step_cert.sh \\
  --name mac-mini \\
  --leaf ~/llama-pack-certs/mac-mini.crt \\
  --key ~/llama-pack-certs/mac-mini.key \\
  --intermediate ~/llama-pack-certs/intermediate_ca.crt \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/root_ca.crt \\
  --cert-dir /opt/homebrew/etc/caddy/certs \\
  --owner robertsmith \\
  --group staff \\
  --expires-in 24h \\
  --reload brew \\
  --force
\`\`\`

Pi:
\`\`\`bash
scripts/renew_caddy_step_cert.sh \\
  --name pi-controller \\
  --leaf ~/llama-pack-certs/pi-controller.crt \\
  --key ~/llama-pack-certs/pi-controller.key \\
  --intermediate ~/.step/certs/intermediate_ca.crt \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/.step/certs/root_ca.crt \\
  --cert-dir /etc/caddy/certs \\
  --expires-in 24h \\
  --reload systemd \\
  --force
\`\`\`

Linux agent:
\`\`\`bash
scripts/renew_caddy_step_cert.sh \\
  --name linux-2080ti \\
  --leaf ~/llama-pack-certs/linux-2080ti.crt \\
  --key ~/llama-pack-certs/linux-2080ti.key \\
  --intermediate ~/llama-pack-certs/intermediate_ca.crt \\
  --ca-url https://pi-controller.local:8443 \\
  --root ~/llama-pack-certs/root_ca.crt \\
  --cert-dir /etc/caddy/certs \\
  --expires-in 24h \\
  --reload systemd \\
  --force
\`\`\`

Expected output: \`Renewed and installed Caddy certificate for: <name>\`.

**Verify the cert expiry after renewal:**

\`\`\`bash
echo | openssl s_client -connect <node>.local:443 2>/dev/null | openssl x509 -noout -dates
\`\`\`

**Verify the full chain is being served** (want \`depth=2\`):

\`\`\`bash
echo | openssl s_client -connect <node>.local:443 2>/dev/null | grep -E "depth|verify"
\`\`\`

If \`depth=0\`, Caddy is serving the leaf cert only without the intermediate.
Re-run the renewal script — the fullchain install step rebuilds
\`<node>-fullchain.crt\` from the leaf + intermediate.

### macOS scheduler gotchas

- Use \`launchd\` (\`~/Library/LaunchAgents\`) for better behavior across network
  transitions and wake/sleep.
- Keep absolute paths in wrapper scripts and LaunchAgent \`ProgramArguments\`.

## Troubleshooting

| Symptom | Meaning | Fix |
| --- | --- | --- |
| \`HTTP/2 502\` from Caddy | TLS works, upstream Llama Pack is not reachable | Check \`curl http://127.0.0.1:9137/health\` on that node and verify \`reverse_proxy\`. |
| \`certificate verify failed\` | Root CA is not trusted by the client | Install \`ca-root.crt\` into the client system trust store. |
| \`unable to get local issuer certificate\` in Python/httpx | Missing intermediate chain or Python is not using system trust | Serve \`*-fullchain.crt\` from Caddy and set \`SSL_CERT_FILE\` to \`llama-pack-ca-chain.crt\`. |
| \`certificate is valid for ..., not ...\` | Hostname does not match the cert SAN | Reissue the node cert with the exact \`.local\` hostname. |
| \`step: Unknown options: ca-url, root\` | Wrong \`step\` binary or old CLI | Install Smallstep \`step-cli\`, then check \`step ca certificate --help\`. |
| \`connect: connection refused\` on \`:8443\` | \`step-ca\` is not running | Start \`step-ca\` or enable the systemd service. See *Running step-ca As A Systemd Service*. |
| \`open /dev/tty: no such device or address\` in step-ca service | step-ca is prompting for a key password with no terminal | Add \`--password-file /etc/step-ca/password.txt\` to the \`ExecStart\` line. |
| \`status=217/USER\` in step-ca service | systemd \`User=\` does not match the actual account | Check \`whoami\` on the Pi and update \`User=\` and \`STEPPATH=\` in the service file. |
| \`error renewing certificate: certificate has expired\` | Cert already past expiry; \`renew\` is blocked | Re-issue with \`step ca certificate ... --force\`, then re-run the renewal script. See *Recovering From Expired Certificates*. |
| \`127.0.0.1:2019 already in use\` | Another Caddy process is running | Stop the manual process or restart the service cleanly. |
| Caddy reload says cert/key permission denied | Caddy service user cannot read \`/etc/caddy/certs\` | Use \`systemctl show caddy -p User -p Group\`, then \`chown root:caddy\`, \`chmod 750\` on the cert dir, \`640\` on keys, and \`644\` on certs. |
| Pi can ping an agent but HTTPS hangs | Firewall blocks TCP 443 | Allow \`443/tcp\` on the agent, for example \`sudo ufw allow 443/tcp\`. |
| Admin API returns \`Unauthorized\` with \`Authorization: Bearer ...\` | Llama Pack does not use Bearer auth for admin APIs | Send \`X-Llama-Manager-Key: $LLAMA_PACK_CONTROLLER_ADMIN_API_KEY\`. |

## Mobile App Note

Private CA HTTPS is fine for LAN/VPN mobile testing only after the phone trusts
the private root CA. For broader mobile access, prefer a public ACME cert on a
real domain such as \`controller.example.com\`.
`,headings:[{level:1,text:`Caddy Local TLS Setup`,anchor:`caddy-local-tls-setup`},{level:2,text:`Hostnames`,anchor:`hostnames`},{level:2,text:`Public Controller, Private Agents`,anchor:`public-controller-private-agents`},{level:2,text:`Certificate Files`,anchor:`certificate-files`},{level:2,text:`Issue Node Certificates`,anchor:`issue-node-certificates`},{level:2,text:`Automatic Certificate Renewal`,anchor:`automatic-certificate-renewal`},{level:3,text:`Linux/Pi systemd timer`,anchor:`linuxpi-systemd-timer`},{level:3,text:`macOS scheduled renewal`,anchor:`macos-scheduled-renewal`},{level:2,text:`Install Certs For Caddy`,anchor:`install-certs-for-caddy`},{level:2,text:`Caddyfiles`,anchor:`caddyfiles`},{level:2,text:`Run Caddy As A Service`,anchor:`run-caddy-as-a-service`},{level:2,text:`Lock Down Llama Pack`,anchor:`lock-down-llama-pack`},{level:2,text:`Switch Llama Pack URLs To HTTPS`,anchor:`switch-llama-pack-urls-to-https`},{level:2,text:`Verification`,anchor:`verification`},{level:2,text:`Recovering From Expired Certificates`,anchor:`recovering-from-expired-certificates`},{level:2,text:`Running step-ca As A Systemd Service`,anchor:`running-step-ca-as-a-systemd-service`},{level:2,text:`Verifying Renewal Is Working`,anchor:`verifying-renewal-is-working`},{level:3,text:`macOS scheduler gotchas`,anchor:`macos-scheduler-gotchas`},{level:2,text:`Troubleshooting`,anchor:`troubleshooting`},{level:2,text:`Mobile App Note`,anchor:`mobile-app-note`}],searchBody:`Caddy Local TLS Setup This is the operator checklist for running Llama Pack controller and agent nodes over local HTTPS with Caddy. You can run Llama Pack without this TLS setup by exposing uvicorn directly on the LAN: In that direct HTTP mode, controller and agent URLs use . That is simpler, but API keys, prompts, responses, and heartbeats travel in plaintext. For local TLS, change to , use URLs, and expose Caddy on . The target shape is: Llama Pack still uses API keys for authorization. Caddy adds transport encryption and keeps uvicorn off the LAN. Hostnames Use stable hostnames everywhere, not IP addresses: Role Hostname --- --- Controller Mac agent Linux agent The same hostname must be used in: - , mDNS, or LAN DNS - the certificate DNS SAN - the Caddy site block - , , and controller After changing , restart the affected Llama Pack process so long-lived HTTP clients do not keep stale resolution behavior. Public Controller, Private Agents For external user or mobile access, the best default topology is a public controller domain with private agents reachable only over a VPN/private network. In this topology: - The controller has a public DNS name and public HTTPS certificate, preferably from ACME/Let's Encrypt through Caddy. - Agents stay off the public internet. Their Caddy listeners are reachable only from the controller over Tailscale, WireGuard, a private subnet, or a private DNS/VPN name. - Public clients use only the controller URL. - The controller URLs use the private/VPN agent names. - Agents set to the public controller URL, because their heartbeat and work-claim traffic goes outbound to the controller. - Agents set to their private/VPN URL, because that is the URL the controller uses to call them. Example controller : Example Mac agent : Example Linux agent : Controller Caddy with a public ACME cert can be as simple as: Agent Caddy can still use private CA certs, Tailscale HTTPS certs, or any certificate trusted by the controller's Python runtime. If agent certs are private CA certs, the controller must still set and to the private CA chain bundle. Do not expose agent Caddy listeners publicly unless the controller cannot reach them privately. Public agents increase the attack surface and require tighter firewall, monitoring, and key-rotation discipline. Certificate Files The CA root and intermediate cert are created by on the CA machine. They are often under: If they are not there, ask Step where it keeps its files: Or search: Copy both CA certs to every machine and keep a local staging copy: On other nodes, copy it with or another trusted transfer method: Install the root into system trust. macOS: Debian, Ubuntu, and Raspberry Pi OS: System trust is not always enough for Python/httpx on every platform. Also point Llama Pack at the CA chain bundle in each node's : Use the local account path on each machine. On the Mac mini, for example: Issue Node Certificates only needs to be running when issuing or renewing certificates. Start it on the CA machine when needed: Issue each node certificate with the exact hostname clients will use. Controller: Mac agent: Linux agent: The example gives 30-day certs if the CA policy allows it. Shorter default certs work, but they need renewal sooner. Automatic Certificate Renewal Smallstep certificates are often short-lived. For this Caddy setup, renewal has three steps: 1. Renew the node leaf certificate with . 2. Rebuild the Caddy fullchain by appending the intermediate CA certificate. 3. Reload Caddy so it serves the renewed certificate. Use the repo helper for all three: For Linux agents, replace with the agent basename, such as . For macOS Homebrew Caddy, use the Homebrew cert directory and reload mode: Preview without changing anything: Linux/Pi systemd timer Copy the examples from : Edit for the local node's paths, hostname, and cert basename. Then enable the timer: Run once immediately: The timer assumes is reachable when renewal runs. If the CA server is not always running, either keep it available on the controller or schedule renewal windows when it is running. macOS scheduled renewal For Homebrew Caddy on macOS, use the dedicated wrapper: For scheduled runs, prefer over . Install the wrapper into a stable user path and point your LaunchAgent to it: LaunchAgent location: should execute: Install Certs For Caddy Caddy should serve a fullchain certificate: the node leaf certificate followed by the intermediate CA certificate. Without the intermediate, may still work in some environments while Python/httpx fails with . Linux and Raspberry Pi: The script builds from the user-writable leaf and intermediate files, then uses to write: - with mode - with mode - with mode - with owner and mode Use to preview the commands after building the local fullchain. For , replace with . macOS with Homebrew on Apple Silicon: Use to confirm . Intel Homebrew commonly uses . Caddyfiles Linux and Raspberry Pi use . Controller: Linux agent: macOS with Homebrew uses on Apple Silicon: Repo templates are also available under . Run Caddy As A Service Linux and Raspberry Pi: After Caddyfile changes: macOS Homebrew: If reports an error, run this to expose the real failure: If the error says is already in use, another Caddy process is already running. Stop the manual process, then restart the service: Lock Down Llama Pack Set uvicorn to loopback on every node: If using , add or update: Restart Llama Pack after changing : Switch Llama Pack URLs To HTTPS Controller : Mac agent : Linux agent : Controller node config should use HTTPS and keep TLS verification enabled: Verification Run from each machine: The TLS output should include: Local uvicorn should still work on the node itself: Direct remote uvicorn access should fail: Controller node visibility: Python/httpx trust from each node: Heartbeats flow from each agent to the controller. If shows stale heartbeats, test the controller URL from the agent process environment first: The controller also calls agents for model/status data, so the controller's Python environment must trust the same CA chain. Recovering From Expired Certificates only works while the cert is still valid. If a cert has already expired, renew is blocked and you must re-issue from scratch. Step 1 — Make sure is running on the Pi: Step 2 — Re-issue the cert on each node (run on the machine that owns the cert): Pi controller: Mac mini: Linux agent: The duration must be within the CA policy limit. If the CA rejects longer durations (e.g. 720h), use . With a 24h cert lifetime, cron must run at least twice a day to stay ahead of expiry — the schedule works. Step 3 — Install and reload Caddy using the renewal script with : Running step-ca As A Systemd Service does not create a systemd service automatically. Without it, the CA goes down on reboot and all renewal cron jobs fail. Create the service file on the Pi: Replace with the actual username. Find the binary path with if it is not at . The flag is required. Without it, tries to prompt for the key password interactively and fails with when run as a service. Create the password file: Enable and start: Verify the CA is reachable: Verifying Renewal Is Working Mac — check the cron log: Pi and Linux — check the systemd timer and service: Force a test run on any machine to confirm the full pipeline end-to-end: Mac: Pi: Linux agent: Expected output: . Verify the cert expiry after renewal: Verify the full chain is being served (want ): If , Caddy is serving the leaf cert only without the intermediate. Re-run the renewal script — the fullchain install step rebuilds from the leaf + intermediate. macOS scheduler gotchas - Use ( ) for better behavior across network transitions and wake/sleep. - Keep absolute paths in wrapper scripts and LaunchAgent . Troubleshooting Symptom Meaning Fix --- --- --- from Caddy TLS works, upstream Llama Pack is not reachable Check on that node and verify . Root CA is not trusted by the client Install into the client system trust store. in Python/httpx Missing intermediate chain or Python is not using system trust Serve from Caddy and set to . Hostname does not match the cert SAN Reissue the node cert with the exact hostname. Wrong binary or old CLI Install Smallstep , then check . on is not running Start or enable the systemd service. See Running step-ca As A Systemd Service. in step-ca service step-ca is prompting for a key password with no terminal Add to the line. in step-ca service systemd does not match the actual account Check on the Pi and update and in the service file. Cert already past expiry; is blocked Re-issue with , then re-run the renewal script. See Recovering From Expired Certificates. Another Caddy process is running Stop the manual process or restart the service cleanly. Caddy reload says cert/key permission denied Caddy service user cannot read Use , then , on the cert dir, on keys, and on certs. Pi can ping an agent but HTTPS hangs Firewall blocks TCP 443 Allow on the agent, for example . Admin API returns with Llama Pack does not use Bearer auth for admin APIs Send . Mobile App Note Private CA HTTPS is fine for LAN/VPN mobile testing only after the phone trusts the private root CA. For broader mobile access, prefer a public ACME cert on a real domain such as .`},{id:`configuration`,title:`Configuration`,sourcePath:`docs/configuration.md`,content:`# Configuration

Set \`LLAMA_PACK_CONFIG\` to a YAML file path. Set \`LLAMA_PACK_MODE\` to override the mode without editing the file.

## Network Exposure

Llama Pack can run in either direct HTTP mode or behind Caddy:

| Mode | Uvicorn bind | URLs | Notes |
| --- | --- | --- | --- |
| Direct LAN HTTP | \`LLAMA_PACK_HOST=0.0.0.0\` | \`http://<host>:9137\` | Simple setup, but controller/agent traffic is plaintext. |
| Caddy/local TLS | \`LLAMA_PACK_HOST=127.0.0.1\` | \`https://<host>.local\` | Recommended for encrypted inter-machine traffic. Caddy listens on \`443\` and proxies to local uvicorn. |

The \`models.*.host\` fields below control \`llama-server\` bind addresses, not the
Llama Pack FastAPI/uvicorn bind address. Prefer \`127.0.0.1\` for model hosts when
Llama Pack proxies model access.

\`\`\`yaml
mode: agent
llama_server_bin: llama-server
llama_cpp_dir: ./llama.cpp
python_bin: ./.venv/bin/python
hf_models_dirs:
  - ./models/HFModels
  - ./models/OtherModels
log_dir: ./logs

models:
  qwen-coder:
    path: ./models/qwen-coder.gguf
    port: 8081
    ctx: 16384
    gpu_layers: 999
    host: 127.0.0.1
    profiles:
      fast:
        ctx: 8192
        gpu_layers: 999
        order: 10
        kind: interactive
        kv_cache_policy: gpu-preferred
        resource_tier: low
      long:
        ctx: 131072
        gpu_layers: 20
        order: 30
        kind: long-context
        kv_cache_policy: cpu-ok
        resource_tier: high
        extra_args:
          - "--cache-type-k"
          - "q4_0"
          - "--cache-type-v"
          - "q4_0"

nodes:
  mac-mini:
    url: http://127.0.0.1:9000
  windows-2080ti:
    url: \${LLAMA_PACK_WINDOWS_2080TI_AGENT_URL}
\`\`\`

## Split Config Files

For small installs, a single \`config.yaml\` is still fine. For controllers,
multi-node agents, or configs with many models and tool definitions, the root
config file can also act as a manifest that links to files in a config
directory.

\`\`\`yaml
mode: agent
files:
  runtime: config/runtime.yaml
  models: config/models.yaml
  agent_tools: config/agent_tools.yaml
  auth: config/auth.yaml
  persistence: config/persistence.yaml
  routing: config/routing.yaml
  nodes: config/nodes.yaml
  memory: config/memory.yaml
\`\`\`

Linked paths are resolved relative to the root config file. Linked file values
are loaded first, then inline values in the root config override linked values.
Environment placeholders such as \`\${LLAMA_PACK_AGENT_URL}\` are expanded
after the files are merged.

\`models\`, \`nodes\`, \`agent_tools\`, and \`memory\` are direct section files. Their
linked YAML content is the value of that top-level config field:

\`\`\`yaml
# config/models.yaml
qwen-coder:
  path: /models/qwen-coder.gguf
  port: 8081
  ctx: 16384
  gpu_layers: 999
\`\`\`

\`runtime\`, \`auth\`, \`persistence\`, and \`routing\` are grouped files. They contain
only the top-level fields that belong to that group:

\`\`\`yaml
# config/runtime.yaml
llama_server_bin: /Users/{user_name}/Apps/llama.cpp/build/bin/llama-server
llama_cpp_dir: /Users/{user_name}/Apps/llama.cpp
python_bin: /Users/{user_name}/Apps/llama.cpp/.venv/bin/python
hf_models_dirs:
  - /Volumes/4TB/HFModels
log_dir: ./logs
controller_url: \${LLAMA_PACK_CONTROLLER_URL}
node_name: mac-mini
agent_url: \${LLAMA_PACK_AGENT_URL}
heartbeat_interval_seconds: 30
\`\`\`

\`\`\`yaml
# config/auth.yaml
agent_api_key: \${LLAMA_PACK_AGENT_API_KEY}
controller_registration_key_outbound: \${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}
\`\`\`

\`\`\`yaml
# config/persistence.yaml
controller_db_url: sqlite+pysqlite:///./logs/controller_state.db
auth_db_url: sqlite+pysqlite:///./logs/auth_store.db
audit_db_url: sqlite+pysqlite:///./logs/audit_events.db
chat_sessions_db_url: sqlite+pysqlite:///./logs/chat_sessions.db
downloads_db_url: sqlite+pysqlite:///./logs/downloads.db
benchmarks_db_url: sqlite+pysqlite:///./logs/benchmarks.db
controller_retention_days: 30
controller_archive_retention_days: 90
controller_archive_dir: ./logs/archive
\`\`\`

\`\`\`yaml
# config/routing.yaml
routing_fanout_enabled: true
routing_fanout_max: 3
agent_worker_enabled: true
agent_worker_poll_interval_seconds: 2
agent_worker_max_jobs: 1
agent_worker_labels:
  gpu: metal
agent_worker_capacity:
  llm.generate: 1
\`\`\`

Unknown file keys are rejected. Grouped files are also validated so fields from
the wrong group fail fast; for example, \`models:\` is not allowed inside
\`config/persistence.yaml\`.

When runtime code calls \`save_config()\` for a split config, linked sections are
written back to their linked files and the root manifest keeps only root-owned
fields plus the \`files:\` mapping. This keeps generated model, node, and tool
updates out of the root file when those sections are split.

## Plugin Config

Plugins are discovered only from configured local paths. Enable a plugin by
listing its id in \`enabled_plugins\` and providing a matching entry in
\`plugins\`:

\`\`\`yaml
enabled_plugins:
  - hello_plugin

plugins:
  hello_plugin:
    path: ./plugins/hello_plugin
    enabled: true
    config:
      reject_chat: false
\`\`\`

Plugin manifests can declare a \`config_schema\` with \`string\`, \`integer\`,
\`number\`, and \`boolean\` fields. Required values are validated before plugin
registration. Fields marked \`secret: true\` are passed to the plugin at runtime
but redacted as \`<redacted>\` in plugin status metadata.

\`\`\`yaml
config_schema:
  properties:
    api_key:
      type: string
      secret: true
    max_items:
      type: integer
  required:
    - api_key
\`\`\`

Plugins can also register migration metadata during \`register()\`:

\`\`\`python
database = context.get_database("main")
context.add_migration_target(
    "main",
    directory="hello_plugin/migrations",
    database=database,
)
\`\`\`

Core reports those targets through:

\`\`\`text
GET  /lm-api/v1/plugins/{plugin_id}/migrations/status
POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade
\`\`\`

Pending or missing plugin migrations appear as warnings in
\`/lm-api/v1/plugins/status\`. Core does not run plugin migrations during startup;
migration execution is explicit through the plugin migration API.

For the full manifest and extension API reference, see
[Plugin Author Guide](plugins.md).

## Agent Config

Use \`mode: agent\` on each machine that actually runs \`llama-server\` processes. Agent mode owns:

- local model definitions under \`models\`
- \`llama_server_bin\` startup for each configured model
- local log files and model process lifecycle
- optional local conversion/library workflows (\`hf_models_dirs\`, \`llama_cpp_dir\`, \`python_bin\`)

Example:

\`\`\`yaml
mode: agent
llama_server_bin: /Users/{user_name}/Apps/llama.cpp/build/bin/llama-server
llama_cpp_dir: /Users/{user_name}/Apps/llama.cpp
python_bin: /Users/{user_name}/Apps/llama.cpp/.venv/bin/python
hf_models_dirs:
  - /Volumes/4TB/HFModels
log_dir: ./logs

models:
  qwen-coder:
    path: /Users/{user_name}/models/qwen-coder.gguf
    port: 8081
    ctx: 16384
    gpu_layers: 999
    host: 127.0.0.1
    reasoning: auto
    reasoning_budget: 2048
    extra_args: []
    supports_json_schema: false
    supports_grammar: false
    vision: false
    mmproj: null
    strengths:
      - coding
      - structured
    cost_tier: medium
    profiles:
      fast:
        ctx: 8192
        gpu_layers: 999
        order: 10
        kind: interactive
        kv_cache_policy: gpu-preferred
        resource_tier: low
        cost_tier: low
      long:
        ctx: 131072
        gpu_layers: 20
        order: 30
        kind: long-context
        kv_cache_policy: cpu-ok
        resource_tier: high
        strengths:
          - coding
          - long_context
        cost_tier: high
        extra_args:
          - "--cache-type-k"
          - "q4_0"
          - "--cache-type-v"
          - "q4_0"
\`\`\`

Nested \`profiles\` are optional. When present, the model key is the logical
family and each profile is a concrete runtime instance such as
\`qwen-coder:fast\` or \`qwen-coder:long\`. Profile values override the base model
for startup; if a profile omits \`port\`, Llama Pack derives one from the base
port plus the profile \`order\`.

Optional \`strengths\` and \`cost_tier\` metadata help the route preview explain
which model should handle an explicit request type. \`strengths\` are lowercase
task labels such as \`coding\`, \`summarization\`, \`structured\`, \`vision\`, and
\`long_context\`. \`cost_tier\` can be \`low\`, \`medium\`, or \`high\`. Profile values
override the base model for preview scoring.

For scripted setup, install llama.cpp before or during agent onboarding:

\`\`\`bash
scripts/install_llama_cpp.sh --backend auto
scripts/onboard_agent.sh \\
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \\
  --agent-url "$LLAMA_PACK_AGENT_URL" \\
  --install-llama-cpp \\
  --llama-cpp-backend auto
\`\`\`

The \`auto\` backend is GPU-first: Apple Silicon selects Metal, hosts with
\`nvcc\` select CUDA, and other machines fall back to CPU. Force a backend with
\`--backend cuda\`, \`--backend metal\`, or \`--backend cpu\` when hardware detection
is not the right choice. Onboarding writes the generated agent config to the
same checkout paths used by the installer.

## Controller Config

Use \`mode: controller\` on a central machine that coordinates agents. Controller mode owns:

- the \`nodes\` list (agent base URLs)
- node health/status aggregation
- proxying model start/stop/restart/log calls to each node

Example:

\`\`\`yaml
mode: controller
log_dir: ./logs

nodes:
  mac-mini:
    url: http://127.0.0.1:9000
  windows-2080ti:
    url: \${LLAMA_PACK_WINDOWS_2080TI_AGENT_URL}
    api_key: your-agent-api-key-if-enabled
    verify_tls: true
    max_running_models: 1   # optional — limits concurrent model instances on this node
\`\`\`

### Node capacity (optional)

Set \`max_running_models\` on any node to cap how many model instances it may run simultaneously. The routing policy uses this when deciding whether to start a model on a node:

- If the node is already at capacity, the route is still selected but \`startup_decision\` is recorded as \`"defer"\` in the internal routing event.
- If the node has room, \`startup_decision\` is \`"start_now"\`.
- If \`max_running_models\` is omitted, the policy always records \`"start_now"\`.

\`\`\`yaml
nodes:
  mac-mini:
    url: http://mac-mini:9000
    max_running_models: 2   # can run up to 2 models concurrently
  rpi-worker:
    url: http://rpi:9000
    max_running_models: 1   # RAM-constrained — only one at a time
\`\`\`

### Registry-aware placement (optional)

When a requested model is not currently running on any node, the routing policy checks each candidate node for **model artifact presence** before giving up:

| Presence tier | Meaning |
|---|---|
| \`registered\` | Model is in the node's config (known to the agent) |
| \`gguf_present\` | GGUF file exists on the node's library disk but is not yet registered |

Candidates with \`registered\` presence are always preferred over \`gguf_present\`. Within each tier, the existing \`priority\` order is preserved. The chosen presence tier is recorded as part of the \`startup_decision\` metadata in the internal routing event (e.g. \`request_type_artifact_registered\`).

This means the controller can route to a node that **could** run a model, not just nodes where one is already running, and the caller or an orchestration layer can act on the \`startup_decision\` field to trigger the actual model start.

See [multi-agent-routing.md](multi-agent-routing.md) for the full routing decision flow.

### Fanout routing (optional)

Add these fields to a controller config to enable multi-agent fanout:

\`\`\`yaml
routing_fanout_enabled: true   # default: false
routing_fanout_max: 3          # default: 2 (primary + up to N-1 additional nodes)
\`\`\`

See [multi-agent-routing.md](multi-agent-routing.md) for full details.

## Raspberry Pi Controller Config

If the Raspberry Pi is the always-on coordinator, run it in \`controller\` mode and point all agent machines at the Pi's URL. Use \`raspberry-pi-controller.config.example.yaml\` as a starting point:

\`\`\`bash
scripts/onboard_controller.sh \\
  --config raspberry-pi-controller.config.yaml \\
  --template raspberry-pi-controller.config.example.yaml
scripts/start_controller.sh
\`\`\`

\`\`\`yaml
mode: controller
log_dir: /home/{user_name}/llama-manager/logs

controller_registration_key: \${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}
node_heartbeat_timeout_seconds: 90

controller_db_url: sqlite+pysqlite:////home/{user_name}/llama-manager/logs/controller_state.db
auth_db_url: sqlite+pysqlite:////home/{user_name}/llama-manager/logs/auth_store.db
audit_db_url: sqlite+pysqlite:////home/{user_name}/llama-manager/logs/audit_events.db
chat_sessions_db_url: sqlite+pysqlite:////home/{user_name}/llama-manager/logs/chat_sessions.db

nodes:
  mac-mini:
    url: \${LLAMA_PACK_MAC_MINI_AGENT_URL}
    api_key: \${LLAMA_PACK_MAC_MINI_AGENT_API_KEY}
    verify_tls: true
  linux-2080ti:
    url: \${LLAMA_PACK_LINUX_2080TI_AGENT_URL}
    api_key: \${LLAMA_PACK_LINUX_2080TI_AGENT_API_KEY}
    verify_tls: true
\`\`\`

Manual startup is also available:

\`\`\`bash
LLAMA_PACK_CONFIG=raspberry-pi-controller.config.yaml uvicorn llama_pack.main:app --host 127.0.0.1 --port 9137
\`\`\`

Agents should run \`scripts/onboard_agent.sh --controller-url "$LLAMA_PACK_CONTROLLER_URL" --agent-url "$LLAMA_PACK_AGENT_URL"\`, or manually keep \`controller_url\` as \`\${LLAMA_PACK_CONTROLLER_URL}\`, keep \`agent_url\` as \`\${LLAMA_PACK_AGENT_URL}\`, and send the same registration key through \`controller_registration_key_outbound\`.

For the current Raspberry Pi controller topology and smoke checks, see
[Raspberry Pi Controller Topology](pi-controller-topology.md).

## Optional Security And Registration Fields

- Agent-side auth: \`agent_api_key\` requires clients to send \`X-Llama-Manager-Key\`.
- Controller-to-agent auth per node: \`nodes.<name>.api_key\`.
- Auto-registration auth: \`controller_registration_key\` on controller, \`controller_registration_key_outbound\` on agent.
- Agent heartbeat/registration fields: \`controller_url\`, \`node_name\`, \`agent_url\`, \`heartbeat_interval_seconds\`.
- Stale node timeout on controller: \`node_heartbeat_timeout_seconds\`.
- Browser external client origins: \`client_cors_origins\` enables CORS for
  explicitly listed origins such as \`http://localhost:5173\`. Leave it empty for
  same-origin UI, CLI clients, server-to-server clients, and Electron apps that
  do not need browser CORS.

## Optional Controller Persistence And Retention Fields

- \`controller_db_url\`: optional SQLite URL/path override for controller orchestration state.
- \`controller_instance_id\`: identifier used for controller leader leases.
- \`controller_leader_lease_seconds\`: lease duration for the controller sweeper.
- \`controller_retention_days\`: active job/event retention window.
- \`controller_archive_retention_days\`: exported archive retention window.
- \`controller_archive_dir\`: archive export directory.

## Optional Agent Worker Fields

- \`agent_worker_enabled\`: opt in to background work claiming from \`controller_url\`.
- \`agent_worker_poll_interval_seconds\`: polling interval when enabled.

## Controller Memory Subsystem

Controllers can maintain a persistent semantic memory store backed by ChromaDB
and a local embedding model. Memory is **controller-only** — agent nodes never
load ChromaDB or \`sentence-transformers\` directly.

The memory store is disabled by default. To enable it:

\`\`\`bash
scripts/onboard_controller.sh --enable-memory
\`\`\`

The onboarding script installs the optional \`controller-memory\` extras,
downloads the default embedding model, writes the \`memory:\` block, validates
the controller config, and stores \`LLAMA_PACK_MEMORY_MODEL_PATH\` in
\`.llama_pack.env\`. Override paths when needed:

\`\`\`bash
scripts/onboard_controller.sh \\
  --enable-memory \\
  --memory-model-path ./models/embedding/all-MiniLM-L6-v2 \\
  --memory-store-path ./logs/agent_memory
\`\`\`

The resulting config includes:

\`\`\`yaml
memory:
  enabled: true
  path: ./logs/agent_memory          # ChromaDB persistence directory
  embedding_model_path: ./models/embedding/all-MiniLM-L6-v2
  auto_inject: true                  # prepend top-K memories to every chat request
  top_k: 3                           # memories retrieved per request
  soft_cap: 500                      # max entries before eviction runs
  ephemeral_ttl_days: 7              # TTL for ephemeral-tier entries
  durable_ttl_days: 90               # TTL for durable-tier entries
\`\`\`

If extras or model installation fails, rerun the printed recovery command:

\`\`\`bash
uv pip install -e '.[controller-memory]'
scripts/install_embedding_model.sh ./models/embedding/all-MiniLM-L6-v2
\`\`\`

For offline hosts where the extras and model are already present, use
\`--skip-memory-install --memory-model-path PATH\`; onboarding will still fail
clearly if the embedding model directory does not exist.

If \`enabled: false\` or the embedding model path does not exist at startup, the
store self-disables with a warning and all memory operations become silent
no-ops — the controller continues to operate normally.

### Memory tiers

| Tier | Written by | TTL | Eviction priority |
|---|---|---|---|
| \`permanent\` | Explicit instruction | Never | Never evicted |
| \`durable\` | Model inference (high-value fact) | \`durable_ttl_days\` from last access | Low |
| \`ephemeral\` | Model inference (task note) | \`ephemeral_ttl_days\` from last access | First evicted |

TTL is access-based — each retrieval resets the clock. When the collection
exceeds \`soft_cap\`, the lowest-scoring ephemeral entries are pruned first.
Duplicate detection uses cosine similarity (threshold 0.92); near-identical
entries are updated in place rather than duplicated.

### Auto-injection

When \`auto_inject: true\`, the controller fetches the top-\`top_k\` most relevant
memories for every incoming chat request and prepends them as a \`[Memory]\`
block in the system message before routing to the selected agent. This is
transparent to the agent — it sees a normal chat request with enriched context.
- \`agent_worker_max_jobs\`: maximum jobs to claim per poll.
- \`agent_worker_labels\`: labels advertised to the controller claim matcher.
- \`agent_worker_capacity\`: numeric/string capacity advertised to the controller claim matcher.

Agent workers must be registered/configured on the controller under \`nodes.<name>\` with an \`api_key\`. The agent sends its \`agent_api_key\` as \`X-Llama-Manager-Key\` when claiming or updating work; unknown nodes and nodes without an API key are rejected.

The first typed worker contract is \`llm.generate\`. It is intentionally narrow and reuses the existing chat payload shape (\`model\`, \`messages\`, sampling fields, structured-output fields, \`reasoning\`, and optional \`target\`/\`requirements\`). Future typed contracts are tracked in \`superpowers/plans/2026-05-12-execution-substrate.md\`.

## Model Capability Hints

Optional chat capability hint fields per model:

- \`supports_json_schema\`: override capability introspection for JSON Schema structured output.
- \`supports_grammar\`: override capability introspection for grammar structured output.
- \`extra_args\`: capability fallback infers structured output support when args include tokens like \`json-schema\` or \`grammar\`.
- \`reasoning\` and \`reasoning_budget\`: configure llama.cpp reasoning mode and budget for supported models.
- \`vision\` and \`mmproj\`: mark multimodal models and point to the matching projector file.
- \`favorite\`: mark a model as a UI favorite so it sorts first in model tables.
- \`profiles\`: optional named runtime profiles grouped under the model family.
  Each profile can override \`ctx\`, \`port\`, \`gpu_layers\`, \`host\`, and
  \`extra_args\`, and can include forward-looking metadata such as \`kind\`,
  \`kv_cache_policy\`, \`resource_tier\`, \`strengths\`, and \`cost_tier\`.

## Agent-Local Tool Calling

Agent mode can run a managed tool loop for direct local testing. Tools are
disabled by default and must be named explicitly in YAML. V1 supports fixed
\`shell\`, \`file_read\`, \`file_read_dynamic\`, \`directory_list\`, and \`http\` tools only; it does not
expose arbitrary commands, paths, or URLs from model output.

\`\`\`yaml
mode: agent
log_dir: ./logs

agent_tools:
  enabled: true
  max_iterations: 4
  tool_timeout_seconds: 10
  safe_roots:
    - ./logs
    - /Users/{user_name}/Apps/llama-pack
  tools:
    list_runtime_status:
      type: shell
      description: Print a short runtime status line.
      command: ["printf", "agent runtime ok"]
    read_agent_note:
      type: file_read
      description: Read a local agent note.
      path: ./logs/agent-note.txt
    read_project_file:
      type: file_read_dynamic
      description: Read a project or log file by relative path.
      path: /Users/{user_name}/Apps/llama-pack
    list_project_files:
      type: directory_list
      description: List top-level and one-level-deep project files.
      path: /Users/{user_name}/Apps/llama-pack
      recursive: true
      max_depth: 1
      max_entries: 200
      include_hidden: false
    local_health:
      type: http
      description: Fetch local health.
      method: GET
      url: http://127.0.0.1:9137/health
\`\`\`

Tool names must match \`^[A-Za-z_][A-Za-z0-9_]{0,63}$\`. \`file_read\` and
\`directory_list\` paths must resolve under \`agent_tools.safe_roots\`.

To test on an agent, tail the trace log and send a non-streaming OpenAI chat
request with \`tool_runtime: "agent"\`:

\`\`\`bash
tail -f ./logs/agent_tool_calls.jsonl
\`\`\`

\`\`\`bash
curl -s http://127.0.0.1:9137/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  -d '{
    "model": "qwen",
    "messages": [
      {"role": "user", "content": "Use list_runtime_status and summarize the result."}
    ],
    "tool_runtime": "agent",
    "stream": false
  }'
\`\`\`

Streaming managed-tool requests are rejected in v1. Controllers do not execute
tools yet; future controller delegation should forward tool-capable turns to a
selected agent and let that agent run this same local loop.

Windows paths work in YAML:

\`\`\`yaml
models:
  gemma4-e2b:
    path: C:\\models\\gemma4-e2b.gguf
    port: 8080
    ctx: 8192
    gpu_layers: 999
\`\`\`
`,headings:[{level:1,text:`Configuration`,anchor:`configuration`},{level:2,text:`Network Exposure`,anchor:`network-exposure`},{level:2,text:`Split Config Files`,anchor:`split-config-files`},{level:2,text:`Plugin Config`,anchor:`plugin-config`},{level:2,text:`Agent Config`,anchor:`agent-config`},{level:2,text:`Controller Config`,anchor:`controller-config`},{level:3,text:`Node capacity (optional)`,anchor:`node-capacity-optional`},{level:3,text:`Registry-aware placement (optional)`,anchor:`registry-aware-placement-optional`},{level:3,text:`Fanout routing (optional)`,anchor:`fanout-routing-optional`},{level:2,text:`Raspberry Pi Controller Config`,anchor:`raspberry-pi-controller-config`},{level:2,text:`Optional Security And Registration Fields`,anchor:`optional-security-and-registration-fields`},{level:2,text:`Optional Controller Persistence And Retention Fields`,anchor:`optional-controller-persistence-and-retention-fields`},{level:2,text:`Optional Agent Worker Fields`,anchor:`optional-agent-worker-fields`},{level:2,text:`Controller Memory Subsystem`,anchor:`controller-memory-subsystem`},{level:3,text:`Memory tiers`,anchor:`memory-tiers`},{level:3,text:`Auto-injection`,anchor:`auto-injection`},{level:2,text:`Model Capability Hints`,anchor:`model-capability-hints`},{level:2,text:`Agent-Local Tool Calling`,anchor:`agent-local-tool-calling`}],searchBody:`Configuration Set to a YAML file path. Set to override the mode without editing the file. Network Exposure Llama Pack can run in either direct HTTP mode or behind Caddy: Mode Uvicorn bind URLs Notes --- --- --- --- Direct LAN HTTP Simple setup, but controller/agent traffic is plaintext. Caddy/local TLS Recommended for encrypted inter-machine traffic. Caddy listens on and proxies to local uvicorn. The fields below control bind addresses, not the Llama Pack FastAPI/uvicorn bind address. Prefer for model hosts when Llama Pack proxies model access. Split Config Files For small installs, a single is still fine. For controllers, multi-node agents, or configs with many models and tool definitions, the root config file can also act as a manifest that links to files in a config directory. Linked paths are resolved relative to the root config file. Linked file values are loaded first, then inline values in the root config override linked values. Environment placeholders such as are expanded after the files are merged. , , , and are direct section files. Their linked YAML content is the value of that top-level config field: , , , and are grouped files. They contain only the top-level fields that belong to that group: Unknown file keys are rejected. Grouped files are also validated so fields from the wrong group fail fast; for example, is not allowed inside . When runtime code calls for a split config, linked sections are written back to their linked files and the root manifest keeps only root-owned fields plus the mapping. This keeps generated model, node, and tool updates out of the root file when those sections are split. Plugin Config Plugins are discovered only from configured local paths. Enable a plugin by listing its id in and providing a matching entry in : Plugin manifests can declare a with , , , and fields. Required values are validated before plugin registration. Fields marked are passed to the plugin at runtime but redacted as in plugin status metadata. Plugins can also register migration metadata during : Core reports those targets through: Pending or missing plugin migrations appear as warnings in . Core does not run plugin migrations during startup; migration execution is explicit through the plugin migration API. For the full manifest and extension API reference, see Plugin Author Guide. Agent Config Use on each machine that actually runs processes. Agent mode owns: - local model definitions under - startup for each configured model - local log files and model process lifecycle - optional local conversion/library workflows ( , , ) Example: Nested are optional. When present, the model key is the logical family and each profile is a concrete runtime instance such as or . Profile values override the base model for startup; if a profile omits , Llama Pack derives one from the base port plus the profile . Optional and metadata help the route preview explain which model should handle an explicit request type. are lowercase task labels such as , , , , and . can be , , or . Profile values override the base model for preview scoring. For scripted setup, install llama.cpp before or during agent onboarding: The backend is GPU-first: Apple Silicon selects Metal, hosts with select CUDA, and other machines fall back to CPU. Force a backend with , , or when hardware detection is not the right choice. Onboarding writes the generated agent config to the same checkout paths used by the installer. Controller Config Use on a central machine that coordinates agents. Controller mode owns: - the list (agent base URLs) - node health/status aggregation - proxying model start/stop/restart/log calls to each node Example: Node capacity (optional) Set on any node to cap how many model instances it may run simultaneously. The routing policy uses this when deciding whether to start a model on a node: - If the node is already at capacity, the route is still selected but is recorded as in the internal routing event. - If the node has room, is . - If is omitted, the policy always records . Registry-aware placement (optional) When a requested model is not currently running on any node, the routing policy checks each candidate node for model artifact presence before giving up: Presence tier Meaning --- --- Model is in the node's config (known to the agent) GGUF file exists on the node's library disk but is not yet registered Candidates with presence are always preferred over . Within each tier, the existing order is preserved. The chosen presence tier is recorded as part of the metadata in the internal routing event (e.g. ). This means the controller can route to a node that could run a model, not just nodes where one is already running, and the caller or an orchestration layer can act on the field to trigger the actual model start. See multi-agent-routing.md for the full routing decision flow. Fanout routing (optional) Add these fields to a controller config to enable multi-agent fanout: See multi-agent-routing.md for full details. Raspberry Pi Controller Config If the Raspberry Pi is the always-on coordinator, run it in mode and point all agent machines at the Pi's URL. Use as a starting point: Manual startup is also available: Agents should run , or manually keep as , keep as , and send the same registration key through . For the current Raspberry Pi controller topology and smoke checks, see Raspberry Pi Controller Topology. Optional Security And Registration Fields - Agent-side auth: requires clients to send . - Controller-to-agent auth per node: . - Auto-registration auth: on controller, on agent. - Agent heartbeat/registration fields: , , , . - Stale node timeout on controller: . - Browser external client origins: enables CORS for explicitly listed origins such as . Leave it empty for same-origin UI, CLI clients, server-to-server clients, and Electron apps that do not need browser CORS. Optional Controller Persistence And Retention Fields - : optional SQLite URL/path override for controller orchestration state. - : identifier used for controller leader leases. - : lease duration for the controller sweeper. - : active job/event retention window. - : exported archive retention window. - : archive export directory. Optional Agent Worker Fields - : opt in to background work claiming from . - : polling interval when enabled. Controller Memory Subsystem Controllers can maintain a persistent semantic memory store backed by ChromaDB and a local embedding model. Memory is controller-only — agent nodes never load ChromaDB or directly. The memory store is disabled by default. To enable it: The onboarding script installs the optional extras, downloads the default embedding model, writes the block, validates the controller config, and stores in . Override paths when needed: The resulting config includes: If extras or model installation fails, rerun the printed recovery command: For offline hosts where the extras and model are already present, use ; onboarding will still fail clearly if the embedding model directory does not exist. If or the embedding model path does not exist at startup, the store self-disables with a warning and all memory operations become silent no-ops — the controller continues to operate normally. Memory tiers Tier Written by TTL Eviction priority --- --- --- --- Explicit instruction Never Never evicted Model inference (high-value fact) from last access Low Model inference (task note) from last access First evicted TTL is access-based — each retrieval resets the clock. When the collection exceeds , the lowest-scoring ephemeral entries are pruned first. Duplicate detection uses cosine similarity (threshold 0.92); near-identical entries are updated in place rather than duplicated. Auto-injection When , the controller fetches the top- most relevant memories for every incoming chat request and prepends them as a block in the system message before routing to the selected agent. This is transparent to the agent — it sees a normal chat request with enriched context. - : maximum jobs to claim per poll. - : labels advertised to the controller claim matcher. - : numeric/string capacity advertised to the controller claim matcher. Agent workers must be registered/configured on the controller under with an . The agent sends its as when claiming or updating work; unknown nodes and nodes without an API key are rejected. The first typed worker contract is . It is intentionally narrow and reuses the existing chat payload shape ( , , sampling fields, structured-output fields, , and optional / ). Future typed contracts are tracked in . Model Capability Hints Optional chat capability hint fields per model: - : override capability introspection for JSON Schema structured output. - : override capability introspection for grammar structured output. - : capability fallback infers structured output support when args include tokens like or . - and : configure llama.cpp reasoning mode and budget for supported models. - and : mark multimodal models and point to the matching projector file. - : mark a model as a UI favorite so it sorts first in model tables. - : optional named runtime profiles grouped under the model family. Each profile can override , , , , and , and can include forward-looking metadata such as , , , , and . Agent-Local Tool Calling Agent mode can run a managed tool loop for direct local testing. Tools are disabled by default and must be named explicitly in YAML. V1 supports fixed , , , , and tools only; it does not expose arbitrary commands, paths, or URLs from model output. Tool names must match . and paths must resolve under . To test on an agent, tail the trace log and send a non-streaming OpenAI chat request with : Streaming managed-tool requests are rejected in v1. Controllers do not execute tools yet; future controller delegation should forward tool-capable turns to a selected agent and let that agent run this same local loop. Windows paths work in YAML:`},{id:`downloads`,title:`Model Downloads`,sourcePath:`docs/downloads.md`,content:`# Model Downloads

Llama Pack can download GGUF model artifacts from Hugging Face into the
configured model library. Downloads are started through the UI or the
\`/lm-api/v1/downloads/*\` API and are recorded in the downloads database.

## Prerequisites

- Configure at least one model library root with \`hf_models_dirs\` or the legacy
  \`hf_models_dir\`. Downloads use the first configured root.
- Run the downloads migration before starting the app:

\`\`\`bash
alembic -x db=downloads upgrade downloads@head
\`\`\`

- Use a Python environment where \`huggingface_hub\` is installed. The downloader
  runs:

\`\`\`bash
{python_bin} -m huggingface_hub.cli.hf download <repo_id> --local-dir <target>
\`\`\`

- For gated Hugging Face repos, sign in with \`hf auth login\` and accept the
  model terms on Hugging Face before starting the download.

## Destination Layout

Downloads write under the first configured model root. Repository IDs are
normalized by replacing \`/\` with \`__\`:

\`\`\`text
hf_models_dirs[0]/
\`-- TheBloke__example-model-GGUF/
\`\`\`

Each download stores the destination path, command, log path, triggering user,
revision, process id, timestamps, and byte progress metadata.

## Selecting Files

Use quant listing before download when a repo contains multiple GGUF files:

\`\`\`bash
curl -s \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  "http://127.0.0.1:9137/lm-api/v1/downloads/TheBloke/example-GGUF/quants"
\`\`\`

The quant listing returns GGUF files with filename, repo path, size, detected
quant label, and any matching multimodal projector sidecar. \`include_file\` must
be a relative \`.gguf\` path; absolute paths, parent traversal, backslashes, and
non-GGUF files are rejected.

## Starting A Download

Download an entire repo:

\`\`\`bash
curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  http://127.0.0.1:9137/lm-api/v1/downloads/TheBloke/example-GGUF/start \\
  -d '{}'
\`\`\`

Download one GGUF file from a specific revision:

\`\`\`bash
curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_API_KEY" \\
  http://127.0.0.1:9137/lm-api/v1/downloads/TheBloke/example-GGUF/start \\
  -d '{
    "revision": "main",
    "include_file": "example.Q4_K_M.gguf"
  }'
\`\`\`

Only one active download per repo is allowed. Starting another download for the
same repo while one is still running returns a conflict.

## Monitoring And History

Useful endpoints:

- \`GET /lm-api/v1/downloads/history?status=running&limit=100\`
- \`GET /lm-api/v1/downloads/{download_id}\`
- \`GET /lm-api/v1/downloads/{download_id}/logs?lines=200\`
- \`GET /lm-api/v1/downloads/{download_id}/logs/stream?lines=200\`
- \`POST /lm-api/v1/downloads/{download_id}/cancel\`
- \`DELETE /lm-api/v1/downloads/{download_id}\`

Download statuses are:

| Status | Meaning |
|---|---|
| \`queued\` | Record was created before the child process was marked running. |
| \`running\` | Hugging Face download process is active. |
| \`succeeded\` | Process exited with code 0. |
| \`failed\` | Process exited non-zero or startup validation failed. |
| \`cancelled\` | User cancelled a running process. |

Progress is computed from bytes present in the destination path. If the selected
file size is known, responses include \`progress_percent\`; otherwise progress is
reported as downloaded bytes with \`progress_percent: null\`.

Completed, failed, or cancelled records can be deleted. Running downloads must
be cancelled before deletion.

## Recommendations

\`GET /lm-api/v1/downloads/recommendations\` returns suggested model downloads
based on the controller health payload. Results are cached in memory for one
hour to avoid repeated Hugging Face API work.

`,headings:[{level:1,text:`Model Downloads`,anchor:`model-downloads`},{level:2,text:`Prerequisites`,anchor:`prerequisites`},{level:2,text:`Destination Layout`,anchor:`destination-layout`},{level:2,text:`Selecting Files`,anchor:`selecting-files`},{level:2,text:`Starting A Download`,anchor:`starting-a-download`},{level:2,text:`Monitoring And History`,anchor:`monitoring-and-history`},{level:2,text:`Recommendations`,anchor:`recommendations`}],searchBody:`Model Downloads Llama Pack can download GGUF model artifacts from Hugging Face into the configured model library. Downloads are started through the UI or the API and are recorded in the downloads database. Prerequisites - Configure at least one model library root with or the legacy . Downloads use the first configured root. - Run the downloads migration before starting the app: - Use a Python environment where is installed. The downloader runs: - For gated Hugging Face repos, sign in with and accept the model terms on Hugging Face before starting the download. Destination Layout Downloads write under the first configured model root. Repository IDs are normalized by replacing with : Each download stores the destination path, command, log path, triggering user, revision, process id, timestamps, and byte progress metadata. Selecting Files Use quant listing before download when a repo contains multiple GGUF files: The quant listing returns GGUF files with filename, repo path, size, detected quant label, and any matching multimodal projector sidecar. must be a relative path; absolute paths, parent traversal, backslashes, and non-GGUF files are rejected. Starting A Download Download an entire repo: Download one GGUF file from a specific revision: Only one active download per repo is allowed. Starting another download for the same repo while one is still running returns a conflict. Monitoring And History Useful endpoints: - - - - - - Download statuses are: Status Meaning --- --- Record was created before the child process was marked running. Hugging Face download process is active. Process exited with code 0. Process exited non-zero or startup validation failed. User cancelled a running process. Progress is computed from bytes present in the destination path. If the selected file size is known, responses include ; otherwise progress is reported as downloaded bytes with . Completed, failed, or cancelled records can be deleted. Running downloads must be cancelled before deletion. Recommendations returns suggested model downloads based on the controller health payload. Results are cached in memory for one hour to avoid repeated Hugging Face API work.`},{id:`frontend`,title:`Frontend Development`,sourcePath:`docs/frontend.md`,content:"# Frontend Development\n\nThe web UI lives in `frontend/` and is a Vite + React + TypeScript app. The production build is emitted into `llama_pack/ui/react` so FastAPI can serve it as static package data.\n\n## Install\n\n```bash\ncd frontend\nnpm ci\n```\n\nDo not commit `frontend/node_modules`.\n\n## Run The Backend\n\nStart FastAPI in another terminal:\n\n```bash\nLLAMA_PACK_CONFIG=config.example.yaml uv run uvicorn llama_pack.main:app --host 127.0.0.1 --port 9137\n```\n\nUse your normal controller or agent config instead of `config.example.yaml` when testing real nodes and model workflows.\n\nThe runtime scripts can also start the backend:\n\n```bash\nscripts/start_controller.sh\n```\n\nFor local development, start the backend and React dev site together:\n\n```bash\nscripts/start_controller_stack.sh\n```\n\nFor agent-mode development, use the matching agent stack helper:\n\n```bash\nscripts/start_agent_stack.sh\n```\n\nBoth stack helpers check their backend and frontend PID files first. If the\nwhole stack is already running, they print a `currently up` message and do not\nrestart either process. If only one side is running, they start the missing\nside.\n\nYou can also use the mode-detecting helper:\n\n```bash\nscripts/dev_fullstack.sh\n```\n\n`scripts/dev_fullstack.sh` auto-detects backend mode from your active config\n(`LLAMA_PACK_CONFIG` or `config.yaml`) and starts `agent` or `controller`\naccordingly. Set `LLAMA_PACK_MODE` explicitly if you want to override this.\n\nUse `scripts/start_controller.sh` or `scripts/start_agent.sh` when you only\nwant to start the backend.\n\n## Run The Vite Dev Server\n\n```bash\nscripts/start_frontend.sh\n```\n\nOpen:\n\n```text\nhttp://127.0.0.1:5173/ui/react/\n```\n\nThe script writes its PID to `.llama_pack_frontend.pid` and logs to\n`logs/llama_pack_frontend_vite.log`. Stop it with:\n\n```bash\nscripts/stop_frontend.sh\n```\n\nThe Vite dev server proxies API requests to `http://127.0.0.1:9137` by default. Override the backend target with:\n\n```bash\nVITE_API_PROXY_TARGET=http://127.0.0.1:9000 scripts/start_frontend.sh\n```\n\nYou can still run Vite directly when you want foreground logs:\n\n```bash\ncd frontend\nnpm run dev\n```\n\n## Test\n\nRun frontend tests directly:\n\n```bash\ncd frontend\nnpm test\n```\n\nRun the Python integration wrapper that installs frontend dependencies and runs the same Vitest suite:\n\n```bash\nuv run pytest tests/test_frontend_tests.py -v\n```\n\nRun UI static-serving checks:\n\n```bash\nuv run pytest tests/test_ui_static_serving.py tests/test_package_data.py -v\n```\n\n## Build\n\n```bash\ncd frontend\nnpm run build\n```\n\nBuild output is written to:\n\n```text\nllama_pack/ui/react\n```\n\nFastAPI serves `/` from `llama_pack/ui/react/index.html` when the React build exists. The generated `assets/*` files are content-hashed, so a rebuild may delete an old asset and add a new one.\n\n## Project Layout\n\n- `src/api/`: typed API helpers by backend domain.\n- `src/components/`: shell, logs modal, and shared UI primitives.\n- `src/features/`: typed pure helpers migrated from the former vanilla frontend.\n- `src/pages/`: routed React pages.\n- `src/routes/pages.ts`: canonical React navigation model.\n- `src/test/`: Vitest setup and app-level smoke coverage.\n\n## Plugin Frontend Metadata\n\nCore loads enabled plugin metadata from `/lm-api/v1/plugins/enabled`.\nThe React shell uses that metadata to add plugin primary navigation, scoped\nsecondary navigation, and host pages for plugin UI routes. New plugin pages use\n`frontend.pages`: the shell fetches an HTML fragment template, imports the\noptional page controller, calls `mountPage(root, host)`, and attaches declared\n`style_entries`. Legacy `frontend.entry` modules remain supported for existing\nplugins.\n\nThe shell also reads `/lm-api/v1/plugins/status` and shows a compact\nadministrator-facing alert when plugins are failed, incompatible, or reporting\nhealth warnings/errors such as pending migration metadata.\n\nThe built-in `/ui/plugins` page lists configured plugin status, health,\nfrontend metadata, redacted config metadata, and registered migration targets.\n\nFor the full plugin frontend metadata contract, see\n[Plugin Author Guide](plugins.md).\n\nPlugin assets are served by FastAPI from each plugin's declared static\ndirectory under:\n\n```text\n/plugin-assets/{plugin_id}/...\n```\n\nCore serves those files but does not bundle them into the core React build.\n\n## Release Notes\n\n- `frontend` is the canonical frontend test/build package.\n- `frontend-tests` has been removed after parity coverage moved into `frontend`.\n- `llama_pack/ui/react` is included in Python package data for release builds.\n- The former vanilla static console files under `llama_pack/ui/*.js`,\n  `llama_pack/ui/index.html`, and `llama_pack/ui/styles.css` have been\n  removed; FastAPI serves the React build directly.\n",headings:[{level:1,text:`Frontend Development`,anchor:`frontend-development`},{level:2,text:`Install`,anchor:`install`},{level:2,text:`Run The Backend`,anchor:`run-the-backend`},{level:2,text:`Run The Vite Dev Server`,anchor:`run-the-vite-dev-server`},{level:2,text:`Test`,anchor:`test`},{level:2,text:`Build`,anchor:`build`},{level:2,text:`Project Layout`,anchor:`project-layout`},{level:2,text:`Plugin Frontend Metadata`,anchor:`plugin-frontend-metadata`},{level:2,text:`Release Notes`,anchor:`release-notes`}],searchBody:`Frontend Development The web UI lives in and is a Vite + React + TypeScript app. The production build is emitted into so FastAPI can serve it as static package data. Install Do not commit . Run The Backend Start FastAPI in another terminal: Use your normal controller or agent config instead of when testing real nodes and model workflows. The runtime scripts can also start the backend: For local development, start the backend and React dev site together: For agent-mode development, use the matching agent stack helper: Both stack helpers check their backend and frontend PID files first. If the whole stack is already running, they print a message and do not restart either process. If only one side is running, they start the missing side. You can also use the mode-detecting helper: auto-detects backend mode from your active config ( or ) and starts or accordingly. Set explicitly if you want to override this. Use or when you only want to start the backend. Run The Vite Dev Server Open: The script writes its PID to and logs to . Stop it with: The Vite dev server proxies API requests to by default. Override the backend target with: You can still run Vite directly when you want foreground logs: Test Run frontend tests directly: Run the Python integration wrapper that installs frontend dependencies and runs the same Vitest suite: Run UI static-serving checks: Build Build output is written to: FastAPI serves from when the React build exists. The generated files are content-hashed, so a rebuild may delete an old asset and add a new one. Project Layout - : typed API helpers by backend domain. - : shell, logs modal, and shared UI primitives. - : typed pure helpers migrated from the former vanilla frontend. - : routed React pages. - : canonical React navigation model. - : Vitest setup and app-level smoke coverage. Plugin Frontend Metadata Core loads enabled plugin metadata from . The React shell uses that metadata to add plugin primary navigation, scoped secondary navigation, and host pages for plugin UI routes. New plugin pages use : the shell fetches an HTML fragment template, imports the optional page controller, calls , and attaches declared . Legacy modules remain supported for existing plugins. The shell also reads and shows a compact administrator-facing alert when plugins are failed, incompatible, or reporting health warnings/errors such as pending migration metadata. The built-in page lists configured plugin status, health, frontend metadata, redacted config metadata, and registered migration targets. For the full plugin frontend metadata contract, see Plugin Author Guide. Plugin assets are served by FastAPI from each plugin's declared static directory under: Core serves those files but does not bundle them into the core React build. Release Notes - is the canonical frontend test/build package. - has been removed after parity coverage moved into . - is included in Python package data for release builds. - The former vanilla static console files under , , and have been removed; FastAPI serves the React build directly.`},{id:`how-to-use`,title:`How To Use Llama Pack`,sourcePath:`docs/how-to-use.md`,content:`# How To Use Llama Pack

This guide shows how to run Llama Pack as a secure local/private LLM gateway
with an operations console. A controller provides the stable API surface for
your apps, while agents run on model hosts and manage local \`llama-server\`
processes.

For the current Raspberry Pi controller deployment snapshot and smoke checks,
see [Raspberry Pi Controller Topology](pi-controller-topology.md).

## 1. Install

From this project directory:

\`\`\`bash
uv sync
\`\`\`

On Windows PowerShell:

\`\`\`powershell
py -3.12 -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -e ".[dev]"
\`\`\`

Prefer \`uv sync\` on macOS and Linux because it uses the checked-in \`uv.lock\`.
For pip-based installs, use an explicit supported interpreter and invoke pip as
\`python -m pip\` from the activated environment.

For a Windows-only checklist and troubleshooting flow, see [Windows Install And Troubleshooting](windows-install.md).

## 2. Script-First Setup

For a controller host:

\`\`\`bash
scripts/onboard_controller.sh
scripts/start_controller.sh
\`\`\`

\`scripts/onboard_controller.sh\` creates \`config.yaml\` when needed, writes
\`.llama_pack.env\`, generates \`LLAMA_PACK_CONTROLLER_REGISTRATION_KEY\`,
runs migrations, and creates the first admin API key. Use
\`--skip-migrations\` only when you want to handle migrations/admin-key creation
manually.

To opt into controller semantic memory in the same setup command:

\`\`\`bash
scripts/onboard_controller.sh --enable-memory
\`\`\`

The memory option installs \`.[controller-memory]\`, downloads the default
embedding model, and writes the required \`memory:\` config. If the host already
has the extras and model, pass \`--skip-memory-install --memory-model-path PATH\`
to only write and validate config.

For an agent host:

\`\`\`bash
export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND=...
scripts/onboard_agent.sh \\
  --node mac-agent \\
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \\
  --agent-url "$LLAMA_PACK_AGENT_URL"
scripts/start_agent.sh
\`\`\`

\`scripts/onboard_agent.sh\` creates an agent config, writes
\`.llama_pack.env\`, generates \`LLAMA_PACK_AGENT_API_KEY\`, and prints the
controller \`nodes:\` entry that must use that agent key. The generated config
keeps \`controller_url\` and \`agent_url\` as environment placeholders; the real
LAN URLs passed to \`--controller-url\` and \`--agent-url\` are written only to
\`.llama_pack.env\`.

To rotate keys later:

\`\`\`bash
scripts/regenerate_key.sh --type controller-registration
scripts/regenerate_key.sh --type agent-api --node mac-agent --agent-url "$LLAMA_PACK_AGENT_URL"
\`\`\`

The startup and stop scripts source \`.llama_pack.env\` automatically:

\`\`\`bash
scripts/start_agent.sh
scripts/stop_server.sh
\`\`\`

## 3. Manual Agent Config

Start from:

\`\`\`bash
cp config.example.yaml config.yaml
\`\`\`

Example Mac agent:

\`\`\`yaml
mode: agent
llama_server_bin: /Users/{user_name}/Apps/llama.cpp/build/bin/llama-server
llama_cpp_dir: /Users/{user_name}/Apps/llama.cpp
python_bin: /Users/{user_name}/Apps/llama.cpp/.venv/bin/python
hf_models_dirs:
  - /Users/{user_name}/models
log_dir: ./logs
agent_api_key: local-agent-key
agent_worker_enabled: false

models:
  qwen-coder:
    path: /Users/{user_name}/models/qwen-coder.gguf
    port: 8081
    ctx: 16384
    gpu_layers: 999
    host: 127.0.0.1
    reasoning: auto
    reasoning_budget: 2048
    extra_args: []
    supports_json_schema: false
    supports_grammar: false
\`\`\`

Legacy single-root config still works:

\`\`\`yaml
hf_models_dir: /Volumes/4TB/HFModels
\`\`\`

If \`hf_models_dirs\` is present, it is used instead of the legacy single-root field.

## 4. Manual Admin Key

Before creating admin keys or starting the service, apply migrations:

\`\`\`bash
export LLAMA_PACK_CONFIG=config.yaml
alembic -x db=controller upgrade controller@head
alembic -x db=auth upgrade auth@head
alembic -x db=audit upgrade audit@head
alembic -x db=chat_sessions upgrade chat_sessions@head
\`\`\`

Before using the UI or protected API routes, create an admin key:

\`\`\`bash
uv run python -m llama_pack.auth --config config.yaml create-admin {user_name}
\`\`\`

The command stores only a hash in \`log_dir/auth_store.db\` and prints the raw key once. Use that key in the UI login form or as the \`X-Llama-Manager-Key\` header for API requests. There is no \`dev\` fallback login.

\`scripts/onboard_controller.sh\` performs these migration and first-admin-key
steps for fresh controller setup.

## 5. Start An Agent

\`\`\`bash
LLAMA_PACK_CONFIG=config.yaml uvicorn llama_pack.main:app --host 127.0.0.1 --port 9000
\`\`\`

On Windows PowerShell:

\`\`\`powershell
$env:LLAMA_PACK_CONFIG = "config.yaml"
uvicorn llama_pack.main:app --host 127.0.0.1 --port 9000
\`\`\`

Check health:

\`\`\`bash
curl http://127.0.0.1:9000/health
\`\`\`

Local Mac helper scripts:

\`\`\`bash
scripts/start_agent.sh
scripts/stop_server.sh
\`\`\`

## 6. Control Models On An Agent

\`\`\`bash
curl http://127.0.0.1:9000/models
curl -X POST http://127.0.0.1:9000/models/qwen-coder/start
curl -X POST http://127.0.0.1:9000/models/qwen-coder/stop
curl -X POST http://127.0.0.1:9000/models/qwen-coder/restart
curl "http://127.0.0.1:9000/logs/qwen-coder?lines=200"
\`\`\`

The underlying OpenAI-compatible endpoint remains on the model port:

\`\`\`bash
curl http://127.0.0.1:8081/health
\`\`\`

## 7. Use Chat Features

Basic API call:

\`\`\`bash
curl -X POST http://127.0.0.1:9000/chat/qwen-coder \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Say hello in one sentence."}
    ],
    "temperature": 0.7,
    "max_tokens": 128
  }'
\`\`\`

The Chat UI supports:

- advanced sampling controls (\`top_p\`, \`top_k\`, \`min_p\`, \`repeat_penalty\`, \`seed\`, \`stop\`, \`n_predict\` alias behavior)
- structured output mode (\`None\`, \`JSON Schema\`, \`Grammar\`) with mutual exclusion and client-side validation
- per-model capability gating from \`GET /chat/capabilities/{model}\`
- capability source metadata (\`default\`, \`config_flag\`, \`extra_args\`) in the feature matrix and capabilities detail panel
- capability debug tools: full JSON detail + \`Copy Capabilities JSON\`
- session save/load with persisted advanced defaults, including structured mode and schema/grammar text

Useful chat endpoints:

- \`POST /chat/{model}\`
- \`POST /chat/{model}/stream\`
- \`GET /chat/capabilities/{model}\`
- \`POST /chat/{model}/inspect\`
- \`POST /chat/{model}/embeddings\`
- \`GET /chat/{model}/kv/slots\`
- \`POST /chat/{model}/kv/slots/{slot_id}\`
- \`GET /chat/{model}/kv/capabilities\`
- \`GET|POST|DELETE /chat/sessions...\`

## 8. Add Existing GGUFs As Runnable Models

Scan and register existing GGUF files:

\`\`\`bash
curl http://127.0.0.1:9000/library/ggufs
curl -X POST http://127.0.0.1:9000/library/ggufs/{file_id}/add-model \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "gemma-4-E2B-it",
    "port": 8080,
    "ctx": 8192,
    "gpu_layers": 999,
    "host": "127.0.0.1"
  }'
\`\`\`

## 9. Convert HF Models To GGUF

Set config values on the agent with HF models:

\`\`\`yaml
hf_models_dirs:
  - /Volumes/4TB/HFModels
  - /Volumes/4TB/OtherModels
llama_cpp_dir: /Users/{user_name}/Apps/llama.cpp
python_bin: /Users/{user_name}/Apps/llama.cpp/.venv/bin/python
\`\`\`

Use:

\`\`\`bash
curl http://127.0.0.1:9000/conversions/models
curl -X POST http://127.0.0.1:9000/conversions/qwen2.5-7b-instruct/start
curl "http://127.0.0.1:9000/conversions/qwen2.5-7b-instruct/logs?lines=200"
\`\`\`

If conversion logs show missing packages (for example \`ModuleNotFoundError: No module named 'transformers'\`), point \`python_bin\` at the correct llama.cpp venv Python.

## 10. Quantize Existing GGUFs

Use:

\`\`\`bash
curl http://127.0.0.1:9000/quantizations/files
curl -X POST http://127.0.0.1:9000/quantizations/{file_id}/start \\
  -H "Content-Type: application/json" \\
  -d '{"type":"Q4_K_M"}'
curl "http://127.0.0.1:9000/quantizations/{file_id}/logs?lines=200"
\`\`\`

## 11. Create A Controller Config (Optional)

For fresh controller setup, prefer the onboarding script:

\`\`\`bash
scripts/onboard_controller.sh
scripts/start_controller.sh
\`\`\`

The script generates \`.llama_pack.env\`, runs migrations, creates the first
admin API key, and prints the registration key for agents. The manual config
shape is:

\`\`\`yaml
mode: controller
log_dir: ./logs

nodes:
  windows-2080ti:
    url: \${LLAMA_PACK_WINDOWS_2080TI_AGENT_URL}
    api_key: windows-agent-key-if-enabled
    verify_tls: true

controller_registration_key: shared-registration-key
node_heartbeat_timeout_seconds: 90
\`\`\`

Run controller (different port from local agent):

\`\`\`bash
LLAMA_PACK_CONFIG=controller.yaml uvicorn llama_pack.main:app --host 127.0.0.1 --port 9100
\`\`\`

If \`controller.yaml\` is recorded in \`.llama_pack.env\` as
\`LLAMA_PACK_CONFIG\`, you can also use:

\`\`\`bash
scripts/start_controller.sh
\`\`\`

For local React UI development, start the controller and Vite dev server
together:

\`\`\`bash
LLAMA_PACK_START_FRONTEND=1 scripts/start_controller.sh
\`\`\`

The React dev site runs at \`http://127.0.0.1:5173/ui/react/\`. See
[Frontend Development](frontend.md) for frontend-only start, stop, test, and
build commands.

Controller endpoints include node inventory/proxy plus orchestration (\`/jobs\`, node \`/work/*\`, stats, retention, archive export). In the UI, use the Nodes page to inspect registered agents, heartbeat freshness, reported models, and remote model Start/Stop/Restart/Logs actions.

## 12. Run The Controller On A Raspberry Pi

Raspberry Pi integration is a good fit for the always-on controller role. The Pi runs \`mode: controller\`, owns node inventory and durable orchestration state, and each agent machine points its \`controller_url\` at the Pi.

\`\`\`bash
scripts/onboard_controller.sh \\
  --config raspberry-pi-controller.config.yaml \\
  --template raspberry-pi-controller.config.example.yaml
scripts/start_controller.sh
\`\`\`

The Pi template keeps agent URLs and per-node API keys in environment
variables. Fill those in after each agent onboarding script prints its generated
\`nodes:\` block.

Pi controller config essentials:

\`\`\`yaml
mode: controller
log_dir: /home/{user_name}/llama-manager/logs
controller_registration_key: \${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY}
node_heartbeat_timeout_seconds: 90

nodes:
  mac-mini:
    url: \${LLAMA_PACK_MAC_MINI_AGENT_URL}
    api_key: \${LLAMA_PACK_MAC_MINI_AGENT_API_KEY}
    verify_tls: true
  linux-2080ti:
    url: \${LLAMA_PACK_LINUX_2080TI_AGENT_URL}
    api_key: \${LLAMA_PACK_LINUX_2080TI_AGENT_API_KEY}
    verify_tls: true
\`\`\`

On each agent, run \`scripts/onboard_agent.sh --controller-url "$LLAMA_PACK_CONTROLLER_URL" --agent-url "$LLAMA_PACK_AGENT_URL"\`. If the agent worker is enabled, make sure the agent's generated \`LLAMA_PACK_AGENT_API_KEY\` matches the corresponding \`nodes.<name>.api_key\` value on the Pi controller.

## 13. Enable Agent Worker Jobs

The controller owns durable jobs. Agents execute jobs only when the worker is explicitly enabled.

Controller config:

\`\`\`yaml
mode: controller
log_dir: ./logs

nodes:
  mac-agent:
    url: http://127.0.0.1:9000
    api_key: local-agent-key
    verify_tls: true
\`\`\`

Worker APIs fail closed: the controller only accepts \`/nodes/{node}/work/*\` requests for registered nodes that have an \`api_key\`, and the request must send that key in \`X-Llama-Manager-Key\`.

Agent config:

\`\`\`yaml
mode: agent
controller_url: \${LLAMA_PACK_CONTROLLER_URL}
node_name: mac-agent
agent_url: \${LLAMA_PACK_AGENT_URL}
agent_api_key: \${LLAMA_PACK_AGENT_API_KEY}
controller_registration_key_outbound: \${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}
agent_worker_enabled: true
agent_worker_poll_interval_seconds: 2
agent_worker_max_jobs: 1
agent_worker_labels:
  platform: mac
agent_worker_capacity:
  vram_gb: 24
\`\`\`

For a new worker agent, \`scripts/onboard_agent.sh\` creates the base agent
config and \`.llama_pack.env\`; then enable \`agent_worker_enabled\` and add the
worker labels/capacity fields in the generated config. Keep concrete LAN URLs
in \`.llama_pack.env\`, not in the tracked agent config.

Create a typed generation job on the controller:

\`\`\`bash
curl -X POST http://127.0.0.1:9100/jobs \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "llm.generate",
    "target": "node:mac-agent",
    "payload": {
      "model": "qwen-coder",
      "messages": [
        {"role": "user", "content": "Say hello in one sentence."}
      ],
      "target": "local",
      "max_tokens": 64,
      "requirements": {
        "labels": {"platform": "mac"},
        "capacity": {"vram_gb": 8}
      }
    }
  }'
\`\`\`

Watch durable events:

\`\`\`bash
curl http://127.0.0.1:9100/jobs/{job_id}/events
\`\`\`

Watch live events with SSE:

\`\`\`bash
curl -N http://127.0.0.1:9100/jobs/{job_id}/events/stream
\`\`\`

Cancel cooperatively:

\`\`\`bash
curl -X POST http://127.0.0.1:9100/jobs/{job_id}/cancel
\`\`\`

Queued jobs cancel immediately. Assigned or running jobs move to \`cancel_requested\`; workers check before and after local model execution and then report a terminal state.

Typed worker contracts include \`llm.generate\`, \`llm.embed\`, \`llm.batch\`,
\`model.transfer\`, \`model.download\`, and \`model.install\`. \`model.download\` jobs
run Hugging Face downloads on the target worker node using that agent's
configured model roots and Hugging Face credentials. \`model.install\` extends
that flow by verifying the downloaded GGUF, registering it in the agent's model
config, and starting it when requested.

## 14. Run Tests

Full test suite:

\`\`\`bash
uv run pytest -v
\`\`\`

The pytest suite installs \`frontend\` dependencies with \`npm ci\` before
running the React frontend unit tests, so \`frontend/node_modules\` does not need
to be checked in.

React frontend unit tests:

\`\`\`bash
cd frontend
npm ci
npm test
\`\`\`

React production build:

\`\`\`bash
cd frontend
npm run build
\`\`\`

The Vite build writes static assets to \`llama_pack/ui/react\`, which is
included in Python package data for release builds.

Frontend development workflow:

- \`docs/frontend.md\`

## 15. Alembic-Managed Persistence

Legacy sqlite store code paths were removed after migration parity validation.
The app now always uses SQLAlchemy-managed persistence implementations across
all databases.

Safe startup procedure when not using \`scripts/onboard_controller.sh\`:

1. Run migrations for all targets:
\`\`\`bash
alembic -x db=controller upgrade controller@head
alembic -x db=auth upgrade auth@head
alembic -x db=audit upgrade audit@head
alembic -x db=chat_sessions upgrade chat_sessions@head
\`\`\`
2. Start the app normally, or use \`scripts/start_controller.sh\` if
   \`.llama_pack.env\` points at the right config.
3. Run focused smoke checks for auth, audit, chat sessions, and jobs.

Rollback procedure:

1. Roll back to a previous application version.
2. Keep the database at its current Alembic head unless a schema rollback is explicitly required.
3. Re-run smoke checks.
`,headings:[{level:1,text:`How To Use Llama Pack`,anchor:`how-to-use-llama-pack`},{level:2,text:`1. Install`,anchor:`1-install`},{level:2,text:`2. Script-First Setup`,anchor:`2-script-first-setup`},{level:2,text:`3. Manual Agent Config`,anchor:`3-manual-agent-config`},{level:2,text:`4. Manual Admin Key`,anchor:`4-manual-admin-key`},{level:2,text:`5. Start An Agent`,anchor:`5-start-an-agent`},{level:2,text:`6. Control Models On An Agent`,anchor:`6-control-models-on-an-agent`},{level:2,text:`7. Use Chat Features`,anchor:`7-use-chat-features`},{level:2,text:`8. Add Existing GGUFs As Runnable Models`,anchor:`8-add-existing-ggufs-as-runnable-models`},{level:2,text:`9. Convert HF Models To GGUF`,anchor:`9-convert-hf-models-to-gguf`},{level:2,text:`10. Quantize Existing GGUFs`,anchor:`10-quantize-existing-ggufs`},{level:2,text:`11. Create A Controller Config (Optional)`,anchor:`11-create-a-controller-config-optional`},{level:2,text:`12. Run The Controller On A Raspberry Pi`,anchor:`12-run-the-controller-on-a-raspberry-pi`},{level:2,text:`13. Enable Agent Worker Jobs`,anchor:`13-enable-agent-worker-jobs`},{level:2,text:`14. Run Tests`,anchor:`14-run-tests`},{level:2,text:`15. Alembic-Managed Persistence`,anchor:`15-alembic-managed-persistence`}],searchBody:`How To Use Llama Pack This guide shows how to run Llama Pack as a secure local/private LLM gateway with an operations console. A controller provides the stable API surface for your apps, while agents run on model hosts and manage local processes. For the current Raspberry Pi controller deployment snapshot and smoke checks, see Raspberry Pi Controller Topology. 1. Install From this project directory: On Windows PowerShell: Prefer on macOS and Linux because it uses the checked-in . For pip-based installs, use an explicit supported interpreter and invoke pip as from the activated environment. For a Windows-only checklist and troubleshooting flow, see Windows Install And Troubleshooting. 2. Script-First Setup For a controller host: creates when needed, writes , generates , runs migrations, and creates the first admin API key. Use only when you want to handle migrations/admin-key creation manually. To opt into controller semantic memory in the same setup command: The memory option installs , downloads the default embedding model, and writes the required config. If the host already has the extras and model, pass to only write and validate config. For an agent host: creates an agent config, writes , generates , and prints the controller entry that must use that agent key. The generated config keeps and as environment placeholders; the real LAN URLs passed to and are written only to . To rotate keys later: The startup and stop scripts source automatically: 3. Manual Agent Config Start from: Example Mac agent: Legacy single-root config still works: If is present, it is used instead of the legacy single-root field. 4. Manual Admin Key Before creating admin keys or starting the service, apply migrations: Before using the UI or protected API routes, create an admin key: The command stores only a hash in and prints the raw key once. Use that key in the UI login form or as the header for API requests. There is no fallback login. performs these migration and first-admin-key steps for fresh controller setup. 5. Start An Agent On Windows PowerShell: Check health: Local Mac helper scripts: 6. Control Models On An Agent The underlying OpenAI-compatible endpoint remains on the model port: 7. Use Chat Features Basic API call: The Chat UI supports: - advanced sampling controls ( , , , , , , alias behavior) - structured output mode ( , , ) with mutual exclusion and client-side validation - per-model capability gating from - capability source metadata ( , , ) in the feature matrix and capabilities detail panel - capability debug tools: full JSON detail + - session save/load with persisted advanced defaults, including structured mode and schema/grammar text Useful chat endpoints: - - - - - - - - - 8. Add Existing GGUFs As Runnable Models Scan and register existing GGUF files: 9. Convert HF Models To GGUF Set config values on the agent with HF models: Use: If conversion logs show missing packages (for example ), point at the correct llama.cpp venv Python. 10. Quantize Existing GGUFs Use: 11. Create A Controller Config (Optional) For fresh controller setup, prefer the onboarding script: The script generates , runs migrations, creates the first admin API key, and prints the registration key for agents. The manual config shape is: Run controller (different port from local agent): If is recorded in as , you can also use: For local React UI development, start the controller and Vite dev server together: The React dev site runs at . See Frontend Development for frontend-only start, stop, test, and build commands. Controller endpoints include node inventory/proxy plus orchestration ( , node , stats, retention, archive export). In the UI, use the Nodes page to inspect registered agents, heartbeat freshness, reported models, and remote model Start/Stop/Restart/Logs actions. 12. Run The Controller On A Raspberry Pi Raspberry Pi integration is a good fit for the always-on controller role. The Pi runs , owns node inventory and durable orchestration state, and each agent machine points its at the Pi. The Pi template keeps agent URLs and per-node API keys in environment variables. Fill those in after each agent onboarding script prints its generated block. Pi controller config essentials: On each agent, run . If the agent worker is enabled, make sure the agent's generated matches the corresponding value on the Pi controller. 13. Enable Agent Worker Jobs The controller owns durable jobs. Agents execute jobs only when the worker is explicitly enabled. Controller config: Worker APIs fail closed: the controller only accepts requests for registered nodes that have an , and the request must send that key in . Agent config: For a new worker agent, creates the base agent config and ; then enable and add the worker labels/capacity fields in the generated config. Keep concrete LAN URLs in , not in the tracked agent config. Create a typed generation job on the controller: Watch durable events: Watch live events with SSE: Cancel cooperatively: Queued jobs cancel immediately. Assigned or running jobs move to ; workers check before and after local model execution and then report a terminal state. Typed worker contracts include , , , , , and . jobs run Hugging Face downloads on the target worker node using that agent's configured model roots and Hugging Face credentials. extends that flow by verifying the downloaded GGUF, registering it in the agent's model config, and starting it when requested. 14. Run Tests Full test suite: The pytest suite installs dependencies with before running the React frontend unit tests, so does not need to be checked in. React frontend unit tests: React production build: The Vite build writes static assets to , which is included in Python package data for release builds. Frontend development workflow: - 15. Alembic-Managed Persistence Legacy sqlite store code paths were removed after migration parity validation. The app now always uses SQLAlchemy-managed persistence implementations across all databases. Safe startup procedure when not using : 1. Run migrations for all targets: 2. Start the app normally, or use if points at the right config. 3. Run focused smoke checks for auth, audit, chat sessions, and jobs. Rollback procedure: 1. Roll back to a previous application version. 2. Keep the database at its current Alembic head unless a schema rollback is explicitly required. 3. Re-run smoke checks.`},{id:`multi-agent-routing`,title:`Multi-Agent Routing`,sourcePath:`docs/multi-agent-routing.md`,content:`# Multi-Agent Routing

This document covers the thread event schema, fanout routing policy, and aggregation step introduced in the Multi-Agent Routing V2 feature set.

## Overview

Thread mode routes each user message through the controller, which selects a target node and model, calls the agent, and records the full interaction as a series of typed events. The features described here extend that baseline to support routing a single user turn to **multiple agents in parallel**, recording each agent's output as internal events, and returning one aggregated public response.

All three features are backward compatible. Existing single-node behavior is unchanged when fanout is not configured.

---

## Thread Event Schema (\`turn_id\`)

Every event appended to a thread now carries a \`turn_id\` — a UUID generated at the start of each user turn and shared by all events that belong to that turn. This allows downstream tools and queries to group events by logical conversation turn rather than by wall-clock time.

### Event types

| \`event_type\`       | \`public\` | Description |
|--------------------|----------|-------------|
| \`user_message\`     | true     | The user's message and merged request metadata |
| \`routing_decision\` | false    | Which node/model was chosen and why, with candidates |
| \`agent_request\`    | false    | Request dispatched to a specific agent node (fanout only) |
| \`agent_response\`   | false    | Raw response from a specific agent node (fanout only) |
| \`aggregation\`      | false    | Combined outputs from all fanout agents before the final response |
| \`assistant_message\`| true     | The final response returned to the caller |
| \`error\`            | true     | Routing or proxy failure |

\`agent_request\` and \`agent_response\` events are only emitted when fanout is active. In single-agent mode the \`routing_decision\` is followed directly by \`assistant_message\`.

### Fetching internal events

Internal events (all non-public types) are accessible via the threads API with admin credentials:

\`\`\`
GET /threads/{thread_id}/events?include_internal=true
\`\`\`

Non-admin callers receive only public events (\`user_message\`, \`assistant_message\`, \`error\`).

---

## Fanout Routing Policy

### What it does

When fanout is enabled, the routing policy selects a **primary node** using the normal deterministic priority order, then collects up to \`routing_fanout_max - 1\` additional eligible nodes from the same request-type candidate list. The full set of targets is returned as \`fanout_targets\` on the \`RouteDecision\`.

The \`service\` layer then dispatches to each target concurrently (sequentially in the current implementation), records \`agent_request\` and \`agent_response\` events for each, aggregates the outputs, and publishes one \`assistant_message\`.

### Configuration

Add these two fields to your controller config:

\`\`\`yaml
mode: controller
routing_fanout_enabled: true   # default: false
routing_fanout_max: 3          # default: 2 (primary + 1 extra)

nodes:
  mac-mini:
    url: http://mac-mini:9000
    request_types:
      coding:
        model: gemma
        priority: 10
  linux-2080ti:
    url: http://linux:9000
    request_types:
      coding:
        model: qwen
        priority: 20
  workstation:
    url: http://workstation:9000
    request_types:
      coding:
        model: mistral
        priority: 30
\`\`\`

With \`routing_fanout_max: 3\` and all three nodes running, a \`coding\` request fans out to all three in priority order (mac-mini first, then linux-2080ti, then workstation).

### Flag-off guarantee

When \`routing_fanout_enabled: false\` (the default), \`fanout_targets\` is always an empty tuple and the service takes the original single-agent code path exactly. No internal \`agent_request\`, \`agent_response\`, or \`aggregation\` events are recorded.

### Fanout scope

Fanout only applies to the \`request_type\` routing path. Thread affinity, explicit \`node:\` targets, and the fallback path always return a single node regardless of the flag.

---

## Aggregation Step

### How it works

When \`fanout_targets\` is non-empty, \`ThreadService\` runs the following sequence for each target in order:

1. Appends an internal \`agent_request\` event with the node, model, and messages payload
2. Calls \`chat_proxy.chat_with_meta\` for that node
3. Appends an internal \`agent_response\` event with the response text (or an error marker if the call failed)

After all targets have been attempted:

4. Appends one internal \`aggregation\` event containing the full list of outputs
5. Appends one public \`assistant_message\` with all successful responses joined by \`\\n\\n---\\n\\n\`

### Partial failures

If one or more agents fail, their outputs are recorded as \`[error: ...]\` in the \`aggregation\` event and excluded from the public response. As long as at least one agent succeeds, the user receives a valid \`assistant_message\`. If every agent fails, the public response text is \`[no successful agent responses]\`.

### Example internal event sequence (2-node fanout)

\`\`\`
user_message        (public)
routing_decision    (internal)
agent_request       (internal) — node: mac-mini
agent_response      (internal) — node: mac-mini
agent_request       (internal) — node: linux-2080ti
agent_response      (internal) — node: linux-2080ti
aggregation         (internal) — outputs: [{mac-mini: "..."}, {linux-2080ti: "..."}]
assistant_message   (public)   — joined text
\`\`\`

All seven events share the same \`turn_id\`.

### Aggregation strategy

The current strategy is simple concatenation with a \`---\` separator. The primary node's response appears first. A pluggable aggregation interface (where a separate model summarises the outputs) is planned for a later ticket.

---

---

## Startup Decision Engine (Ticket 9.1)

### Overview

When the routing policy selects a candidate node where the model is **not currently running** (via the availability pass), it now also decides whether a new model instance *should* be started immediately.

This decision is recorded on the \`RouteDecision\` as two new fields:

| Field | Type | Description |
|---|---|---|
| \`startup_needed\` | \`bool\` | \`True\` when the model was not running at route time |
| \`startup_decision\` | \`str \\| None\` | \`"start_now"\` or \`"defer"\` (only set when \`startup_needed\` is \`True\`) |

These fields surface in the internal \`routing_decision\` event content alongside \`node\`, \`model\`, \`reason\`, and \`candidates\`.

### Capacity check

The policy calls \`_thread_node_startup_allowed\` in \`main.py\`, which:

1. Reads \`NodeConfig.max_running_models\` for the target node.
2. If set, queries \`GET /models\` on the node and counts how many models are currently \`running\`.
3. Returns \`False\` (→ \`"defer"\`) when \`running_count >= max_running_models\`.
4. Returns \`True\` (→ \`"start_now"\`) when under the limit, or when \`max_running_models\` is not set.

### Configuration

\`\`\`yaml
nodes:
  mac-mini:
    url: http://mac-mini:9000
    max_running_models: 2
  rpi-worker:
    url: http://rpi:9000
    max_running_models: 1
\`\`\`

### What \`startup_decision\` does today

The current implementation records the decision as metadata — it does **not** automatically trigger \`POST /models/{name}/start\`. Acting on a \`"start_now"\` decision is left to the caller or a future orchestration layer. The benchmark managed-lifecycle feature (\`managed_load\`) is an example of a caller that reads this kind of signal to drive the full lifecycle.

---

## Registry-Aware Placement (Ticket 9.2)

### Overview

Previously, the availability pass only called \`model_available\`, which returned a boolean. Now it queries \`model_artifact_presence\`, which returns one of three tiers:

| Return value | Meaning |
|---|---|
| \`"registered"\` | Model entry exists in the agent's config (registered via library) |
| \`"gguf_present"\` | GGUF file is on disk in the agent's library but not yet registered |
| \`None\` | Model artifact is not present on this node |

### Candidate scoring

Within the availability pass, candidates are scored as follows:

1. **Running** — model is already loaded. Returned immediately (no startup needed).
2. **Registered** — model is configured on the node but not running. Preferred over \`gguf_present\`.
3. **GGUF present** — file is on disk. Useful fallback when a model has been received via transfer but not yet registered.
4. **None** — node is excluded from consideration for this request.

Within each tier, the existing \`priority\` order from the \`request_types\` config is preserved.

### Route reason strings

The \`reason\` field on the routing decision reflects the path taken:

| Reason | Meaning |
|---|---|
| \`request_type\` | Model was running; chosen via request-type priority |
| \`request_type_artifact_registered\` | Model was registered but not running; chosen via request-type |
| \`request_type_artifact_gguf_present\` | GGUF file found but unregistered; chosen via request-type |
| \`request_type_model_available\` | Legacy path (when \`model_artifact_presence\` is not wired) |
| \`fallback\` | Model was running; chosen via fallback |
| \`fallback_artifact_registered\` | Model registered but not running; chosen via fallback |
| \`fallback_artifact_gguf_present\` | GGUF present but unregistered; chosen via fallback |
| \`fallback_model_available\` | Legacy fallback path |
| \`thread_affinity\` | Previous turn's node reused (model still running) |
| \`explicit_target\` | Explicit \`node:\` target specified |

### Example: received transfer routes to the right node

Node \`linux-2080ti\` just received a GGUF via model transfer. It is not registered. Node \`mac-mini\` has no artifact. A \`coding\` request arrives:

\`\`\`
1. Check running:      mac-mini: no    linux-2080ti: no
2. Check artifacts:    mac-mini: None  linux-2080ti: gguf_present
3. Route → linux-2080ti, reason: request_type_artifact_gguf_present, startup_decision: start_now
\`\`\`

The internal \`routing_decision\` event records \`artifact_state: "gguf_present"\` in the candidate metadata.

---

## API reference

These features use the existing threads endpoints — no new routes were added.

\`\`\`
POST /threads                              Create a thread
POST /threads/{thread_id}/messages         Send a user message (triggers fanout if configured)
GET  /threads/{thread_id}/events           Public events only
GET  /threads/{thread_id}/events?include_internal=true   All events (admin only)
\`\`\`

See [api.md](api.md) for full request/response shapes.
`,headings:[{level:1,text:`Multi-Agent Routing`,anchor:`multi-agent-routing`},{level:2,text:`Overview`,anchor:`overview`},{level:2,text:"Thread Event Schema (`turn_id`)",anchor:`thread-event-schema-turn-id`},{level:3,text:`Event types`,anchor:`event-types`},{level:3,text:`Fetching internal events`,anchor:`fetching-internal-events`},{level:2,text:`Fanout Routing Policy`,anchor:`fanout-routing-policy`},{level:3,text:`What it does`,anchor:`what-it-does`},{level:3,text:`Configuration`,anchor:`configuration`},{level:3,text:`Flag-off guarantee`,anchor:`flag-off-guarantee`},{level:3,text:`Fanout scope`,anchor:`fanout-scope`},{level:2,text:`Aggregation Step`,anchor:`aggregation-step`},{level:3,text:`How it works`,anchor:`how-it-works`},{level:3,text:`Partial failures`,anchor:`partial-failures`},{level:3,text:`Example internal event sequence (2-node fanout)`,anchor:`example-internal-event-sequence-2-node-fanout`},{level:3,text:`Aggregation strategy`,anchor:`aggregation-strategy`},{level:2,text:`Startup Decision Engine (Ticket 9.1)`,anchor:`startup-decision-engine-ticket-91`},{level:3,text:`Overview`,anchor:`overview`},{level:3,text:`Capacity check`,anchor:`capacity-check`},{level:3,text:`Configuration`,anchor:`configuration`},{level:3,text:"What `startup_decision` does today",anchor:`what-startup-decision-does-today`},{level:2,text:`Registry-Aware Placement (Ticket 9.2)`,anchor:`registry-aware-placement-ticket-92`},{level:3,text:`Overview`,anchor:`overview`},{level:3,text:`Candidate scoring`,anchor:`candidate-scoring`},{level:3,text:`Route reason strings`,anchor:`route-reason-strings`},{level:3,text:`Example: received transfer routes to the right node`,anchor:`example-received-transfer-routes-to-the-right-node`},{level:2,text:`API reference`,anchor:`api-reference`}],searchBody:`Multi-Agent Routing This document covers the thread event schema, fanout routing policy, and aggregation step introduced in the Multi-Agent Routing V2 feature set. Overview Thread mode routes each user message through the controller, which selects a target node and model, calls the agent, and records the full interaction as a series of typed events. The features described here extend that baseline to support routing a single user turn to multiple agents in parallel, recording each agent's output as internal events, and returning one aggregated public response. All three features are backward compatible. Existing single-node behavior is unchanged when fanout is not configured. --- Thread Event Schema ( ) Every event appended to a thread now carries a — a UUID generated at the start of each user turn and shared by all events that belong to that turn. This allows downstream tools and queries to group events by logical conversation turn rather than by wall-clock time. Event types Description -------------------- ---------- ------------- true The user's message and merged request metadata false Which node/model was chosen and why, with candidates false Request dispatched to a specific agent node (fanout only) false Raw response from a specific agent node (fanout only) false Combined outputs from all fanout agents before the final response true The final response returned to the caller true Routing or proxy failure and events are only emitted when fanout is active. In single-agent mode the is followed directly by . Fetching internal events Internal events (all non-public types) are accessible via the threads API with admin credentials: Non-admin callers receive only public events ( , , ). --- Fanout Routing Policy What it does When fanout is enabled, the routing policy selects a primary node using the normal deterministic priority order, then collects up to additional eligible nodes from the same request-type candidate list. The full set of targets is returned as on the . The layer then dispatches to each target concurrently (sequentially in the current implementation), records and events for each, aggregates the outputs, and publishes one . Configuration Add these two fields to your controller config: With and all three nodes running, a request fans out to all three in priority order (mac-mini first, then linux-2080ti, then workstation). Flag-off guarantee When (the default), is always an empty tuple and the service takes the original single-agent code path exactly. No internal , , or events are recorded. Fanout scope Fanout only applies to the routing path. Thread affinity, explicit targets, and the fallback path always return a single node regardless of the flag. --- Aggregation Step How it works When is non-empty, runs the following sequence for each target in order: 1. Appends an internal event with the node, model, and messages payload 2. Calls for that node 3. Appends an internal event with the response text (or an error marker if the call failed) After all targets have been attempted: 4. Appends one internal event containing the full list of outputs 5. Appends one public with all successful responses joined by Partial failures If one or more agents fail, their outputs are recorded as in the event and excluded from the public response. As long as at least one agent succeeds, the user receives a valid . If every agent fails, the public response text is . Example internal event sequence (2-node fanout) All seven events share the same . Aggregation strategy The current strategy is simple concatenation with a separator. The primary node's response appears first. A pluggable aggregation interface (where a separate model summarises the outputs) is planned for a later ticket. --- --- Startup Decision Engine (Ticket 9.1) Overview When the routing policy selects a candidate node where the model is not currently running (via the availability pass), it now also decides whether a new model instance should be started immediately. This decision is recorded on the as two new fields: Field Type Description --- --- --- when the model was not running at route time or (only set when is ) These fields surface in the internal event content alongside , , , and . Capacity check The policy calls in , which: 1. Reads for the target node. 2. If set, queries on the node and counts how many models are currently . 3. Returns (→ ) when . 4. Returns (→ ) when under the limit, or when is not set. Configuration What does today The current implementation records the decision as metadata — it does not automatically trigger . Acting on a decision is left to the caller or a future orchestration layer. The benchmark managed-lifecycle feature ( ) is an example of a caller that reads this kind of signal to drive the full lifecycle. --- Registry-Aware Placement (Ticket 9.2) Overview Previously, the availability pass only called , which returned a boolean. Now it queries , which returns one of three tiers: Return value Meaning --- --- Model entry exists in the agent's config (registered via library) GGUF file is on disk in the agent's library but not yet registered Model artifact is not present on this node Candidate scoring Within the availability pass, candidates are scored as follows: 1. Running — model is already loaded. Returned immediately (no startup needed). 2. Registered — model is configured on the node but not running. Preferred over . 3. GGUF present — file is on disk. Useful fallback when a model has been received via transfer but not yet registered. 4. None — node is excluded from consideration for this request. Within each tier, the existing order from the config is preserved. Route reason strings The field on the routing decision reflects the path taken: Reason Meaning --- --- Model was running; chosen via request-type priority Model was registered but not running; chosen via request-type GGUF file found but unregistered; chosen via request-type Legacy path (when is not wired) Model was running; chosen via fallback Model registered but not running; chosen via fallback GGUF present but unregistered; chosen via fallback Legacy fallback path Previous turn's node reused (model still running) Explicit target specified Example: received transfer routes to the right node Node just received a GGUF via model transfer. It is not registered. Node has no artifact. A request arrives: The internal event records in the candidate metadata. --- API reference These features use the existing threads endpoints — no new routes were added. See api.md for full request/response shapes.`},{id:`pi-controller-topology`,title:`Raspberry Pi Controller Topology`,sourcePath:`docs/pi-controller-topology.md`,content:`# Raspberry Pi Controller Topology

Snapshot date: 2026-05-18

This is the first known-good three-machine deployment:

| Role | Node name | URL | Notes |
| --- | --- | --- | --- |
| Controller | raspberry-pi-controller | \`$LLAMA_PACK_CONTROLLER_URL\` | Runs \`mode: controller\`; agents register and heartbeat here. |
| Agent | mac-mini | \`$LLAMA_PACK_AGENT_URL\` on the Mac mini; \`$LLAMA_PACK_MAC_MINI_AGENT_URL\` on the controller | Local Mac mini agent config points at the Raspberry Pi controller. |
| Agent | linux-2080ti | \`$LLAMA_PACK_LINUX_2080TI_AGENT_URL\` | 2080 Ti box agent; confirm the current value from the Pi controller \`/nodes\` output. |

The important topology rule is that every agent uses the Raspberry Pi URL as
\`controller_url\`, and the controller uses each agent's \`agent_url\` to proxy
health, model, log, and job operations.

## Mac Mini Agent Values

The Mac mini local config currently has:

\`\`\`yaml
mode: agent
controller_url: \${LLAMA_PACK_CONTROLLER_URL}
node_name: mac-mini
agent_url: \${LLAMA_PACK_AGENT_URL}
heartbeat_interval_seconds: 30
\`\`\`

Keep \`LLAMA_PACK_AGENT_API_KEY\` and
\`LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND\` in \`.llama_pack.env\`,
not in tracked docs or config examples.

The Mac mini \`.llama_pack.env\` should also include:

\`\`\`bash
export LLAMA_PACK_CONTROLLER_URL=http://<raspberry-pi-lan-address>:9137
export LLAMA_PACK_AGENT_URL=http://<mac-mini-lan-address>:9137
\`\`\`

## Smoke Checks

Run these from the Mac mini or any machine on the same network.

Controller health:

\`\`\`bash
curl -s "$LLAMA_PACK_CONTROLLER_URL/health"
\`\`\`

Expected shape:

\`\`\`json
{
  "ok": true,
  "mode": "controller",
  "nodes_configured": 2
}
\`\`\`

Mac mini agent health:

\`\`\`bash
curl -s "$LLAMA_PACK_AGENT_URL/health"
\`\`\`

Expected shape:

\`\`\`json
{
  "ok": true,
  "mode": "agent"
}
\`\`\`

Controller node inventory, with an admin/controller API key:

\`\`\`bash
curl -s "$LLAMA_PACK_CONTROLLER_URL/nodes" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_CONTROLLER_API_KEY"
\`\`\`

Expected checks:

- \`mac-mini\` is present.
- \`linux-2080ti\` is present.
- Both nodes have \`heartbeat_fresh: true\`.
- Each node's \`url\` matches the reachable agent URL on the LAN.

Linux 2080 Ti agent health, after confirming the current URL from \`/nodes\`:

\`\`\`bash
curl -s "$LLAMA_PACK_LINUX_2080TI_AGENT_URL/health" \\
  -H "X-Llama-Manager-Key: $LLAMA_PACK_LINUX_2080TI_AGENT_API_KEY"
\`\`\`

## Agent Startup

Each agent should be started with its local config and listen on the LAN:

\`\`\`bash
scripts/start_agent.sh
\`\`\`

The agent config must include:

\`\`\`yaml
mode: agent
controller_url: \${LLAMA_PACK_CONTROLLER_URL}
node_name: NODE_NAME
agent_url: \${LLAMA_PACK_AGENT_URL}
controller_registration_key_outbound: \${LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND}
\`\`\`

## Controller Startup

The Raspberry Pi should run:

\`\`\`bash
scripts/start_controller.sh
\`\`\`

The controller config should include both agents under \`nodes\`:

\`\`\`yaml
mode: controller
nodes:
  mac-mini:
    url: \${LLAMA_PACK_MAC_MINI_AGENT_URL}
    api_key: \${LLAMA_PACK_MAC_MINI_AGENT_API_KEY}
  linux-2080ti:
    url: \${LLAMA_PACK_LINUX_2080TI_AGENT_URL}
    api_key: \${LLAMA_PACK_LINUX_2080TI_AGENT_API_KEY}
\`\`\`

## Troubleshooting

If controller health works but \`/nodes\` returns \`Unauthorized\`, export an admin
or controller API key and retry with \`X-Llama-Manager-Key\`.

If a node is listed but not fresh, check that the agent has:

- \`controller_url: \${LLAMA_PACK_CONTROLLER_URL}\` and the Pi URL in \`.llama_pack.env\`
- the correct \`node_name\`
- \`agent_url: \${LLAMA_PACK_AGENT_URL}\` and its LAN-reachable URL in \`.llama_pack.env\`
- the same registration key value the Pi expects
- a running \`scripts/start_agent.sh\` process
`,headings:[{level:1,text:`Raspberry Pi Controller Topology`,anchor:`raspberry-pi-controller-topology`},{level:2,text:`Mac Mini Agent Values`,anchor:`mac-mini-agent-values`},{level:2,text:`Smoke Checks`,anchor:`smoke-checks`},{level:2,text:`Agent Startup`,anchor:`agent-startup`},{level:2,text:`Controller Startup`,anchor:`controller-startup`},{level:2,text:`Troubleshooting`,anchor:`troubleshooting`}],searchBody:`Raspberry Pi Controller Topology Snapshot date: 2026-05-18 This is the first known-good three-machine deployment: Role Node name URL Notes --- --- --- --- Controller raspberry-pi-controller Runs ; agents register and heartbeat here. Agent mac-mini on the Mac mini; on the controller Local Mac mini agent config points at the Raspberry Pi controller. Agent linux-2080ti 2080 Ti box agent; confirm the current value from the Pi controller output. The important topology rule is that every agent uses the Raspberry Pi URL as , and the controller uses each agent's to proxy health, model, log, and job operations. Mac Mini Agent Values The Mac mini local config currently has: Keep and in , not in tracked docs or config examples. The Mac mini should also include: Smoke Checks Run these from the Mac mini or any machine on the same network. Controller health: Expected shape: Mac mini agent health: Expected shape: Controller node inventory, with an admin/controller API key: Expected checks: - is present. - is present. - Both nodes have . - Each node's matches the reachable agent URL on the LAN. Linux 2080 Ti agent health, after confirming the current URL from : Agent Startup Each agent should be started with its local config and listen on the LAN: The agent config must include: Controller Startup The Raspberry Pi should run: The controller config should include both agents under : Troubleshooting If controller health works but returns , export an admin or controller API key and retry with . If a node is listed but not fresh, check that the agent has: - and the Pi URL in - the correct - and its LAN-reachable URL in - the same registration key value the Pi expects - a running process`},{id:`plugin-databases`,title:`Plugin Database Contract`,sourcePath:`docs/plugin-databases.md`,content:`# Plugin Database Contract

This design defines how Llama Pack plugins store durable data without coupling
core to plugin-owned schemas or models.

Plugins may need persistent data for usage accounting, identity mappings,
policy state, paid-feature configuration, reporting, connectors, or other
domain-specific workflows. Core should provide a stable database and migration
contract, but it should not import plugin ORM models, define plugin tables, or
mix plugin data into core databases.

## Goals

- Keep core databases focused on core runtime state.
- Give each plugin isolated durable storage under the runtime \`log_dir\`.
- Let plugins own their schemas, migrations, stores, and ORM/domain models.
- Let core expose operator-visible migration status and explicit migration
  execution.
- Make backup, restore, removal, and support workflows simpler by keeping plugin
  data separate from core data.

## Non-Goals

- Core does not inspect or validate plugin table definitions.
- Core does not import plugin ORM metadata.
- Core does not auto-run plugin migrations at startup by default.
- Core does not provide cross-plugin joins or shared plugin tables.
- Core does not put plugin tables into \`controller_state.db\`, \`auth_store.db\`,
  or other core-owned databases.

## Storage Location

Each enabled plugin receives a private state directory:

\`\`\`text
{log_dir}/plugins/{plugin_id}/state/
\`\`\`

Plugin databases live inside that directory. A plugin with one primary database
should use:

\`\`\`text
{log_dir}/plugins/{plugin_id}/state/{plugin_id}.db
\`\`\`

Plugins that need multiple independent stores may use additional database names:

\`\`\`text
{log_dir}/plugins/{plugin_id}/state/{database_name}.db
\`\`\`

Database names should use the same safe identifier style as plugin ids:
lowercase letters, numbers, and underscores. Core should reject path separators
and traversal segments in database names.

## Core Contract

Core exposes a narrow \`PluginContext\` database API:

\`\`\`python
database = context.get_database("main")

context.add_migration_target(
    "main",
    directory="llama_pack_business/migrations/main",
    database=database,
)
\`\`\`

The database handle should expose only core-owned plumbing:

- \`name\`: configured plugin-local database name.
- \`path\`: resolved database file path under the plugin state directory.
- \`url\`: SQLAlchemy-compatible SQLite URL.

Plugins remain responsible for creating stores, engines, sessions, ORM models,
and domain APIs from that URL. Core provides the location and migration
lifecycle, not the schema.

## Migration Contract

Plugins define schema changes as versioned migration files in the plugin package
or repository. Alembic-style migrations are preferred because they are explicit,
reviewable, ordered, and compatible with the existing Llama Pack persistence
tooling.

Core should extend the existing plugin migration metadata into an executable
contract:

\`\`\`text
GET  /lm-api/v1/plugins/{plugin_id}/migrations/status
POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade
\`\`\`

A later CLI could wrap the same service. No core CLI is shipped yet:

\`\`\`bash
curl -X POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade
\`\`\`

Migration status should include:

- plugin id
- target id
- database URL or redacted database path
- migration directory
- current revision
- head revision
- status: \`current\`, \`missing\`, \`pending\`, \`unknown\`, or \`failed\`
- last migration error, when available

Startup should continue to report missing or pending plugin migrations as health
warnings. Startup should not silently mutate plugin databases unless an explicit
operator setting is added later.

## Ownership Boundary

Core owns:

- Resolving plugin database paths safely.
- Ensuring plugin database files stay under the plugin state directory.
- Providing SQLAlchemy-compatible URLs.
- Registering migration targets.
- Reporting migration status in plugin status endpoints.
- Running explicit migration commands when requested.
- Emitting migration lifecycle events such as pending, started, completed, and
  failed.

Plugins own:

- Tables, indexes, constraints, and migrations.
- ORM models and store classes.
- Reads, writes, validation, and domain behavior.
- Plugin data retention and export semantics.
- Tests that prove plugin migrations and stores work.

This boundary keeps core generic. A paid add-on such as \`llama_pack_business\` can
store business identity, usage, quota, audit, and reporting data without making
core aware of those models.

## Backup And Restore

Separate plugin databases make backup and restore more predictable:

- Core backups can include only core databases when operators want a clean core
  restore.
- Full-instance backups can include \`logs/plugins/\` when operators want plugin
  data restored too.
- Paid/private plugin support can inspect plugin-owned databases without
  touching core runtime databases.
- Plugin uninstall or reset workflows can remove a plugin state directory
  without schema surgery in core databases.

The backup tooling should eventually expose plugin databases as named units, for
example:

\`\`\`text
core:controller
core:auth
plugin:llama_pack_business:main
\`\`\`

## Failure Handling

Plugin database failures should degrade the plugin, not the core runtime.

- If a plugin migration is missing or pending, the plugin remains enabled unless
  the plugin marks that migration as required for registration.
- If explicit migration execution fails, core records the failure in plugin
  health/status and returns an operator-visible error.
- If plugin store initialization fails during registration, that plugin should
  fail or disable itself through normal plugin registration error handling.
- Core routes, auth, chat, and node management should continue to work when a
  plugin database is broken.

## Testing Expectations

Core tests should cover:

- Database path resolution stays inside plugin state directories.
- Invalid database names are rejected.
- Migration targets can be registered with plugin database URLs.
- Migration status reports current, pending, missing, and failed targets.
- Explicit migration execution affects only the selected plugin database.
- Plugin database failures are reported in plugin status without breaking core
  startup.

Plugin tests should cover:

- Fresh database creation.
- Migration from older revisions.
- Store read/write behavior.
- Plugin registration with missing, pending, and current schemas.
- Backup/restore expectations for plugin-owned state when applicable.
`,headings:[{level:1,text:`Plugin Database Contract`,anchor:`plugin-database-contract`},{level:2,text:`Goals`,anchor:`goals`},{level:2,text:`Non-Goals`,anchor:`non-goals`},{level:2,text:`Storage Location`,anchor:`storage-location`},{level:2,text:`Core Contract`,anchor:`core-contract`},{level:2,text:`Migration Contract`,anchor:`migration-contract`},{level:2,text:`Ownership Boundary`,anchor:`ownership-boundary`},{level:2,text:`Backup And Restore`,anchor:`backup-and-restore`},{level:2,text:`Failure Handling`,anchor:`failure-handling`},{level:2,text:`Testing Expectations`,anchor:`testing-expectations`}],searchBody:`Plugin Database Contract This design defines how Llama Pack plugins store durable data without coupling core to plugin-owned schemas or models. Plugins may need persistent data for usage accounting, identity mappings, policy state, paid-feature configuration, reporting, connectors, or other domain-specific workflows. Core should provide a stable database and migration contract, but it should not import plugin ORM models, define plugin tables, or mix plugin data into core databases. Goals - Keep core databases focused on core runtime state. - Give each plugin isolated durable storage under the runtime . - Let plugins own their schemas, migrations, stores, and ORM/domain models. - Let core expose operator-visible migration status and explicit migration execution. - Make backup, restore, removal, and support workflows simpler by keeping plugin data separate from core data. Non-Goals - Core does not inspect or validate plugin table definitions. - Core does not import plugin ORM metadata. - Core does not auto-run plugin migrations at startup by default. - Core does not provide cross-plugin joins or shared plugin tables. - Core does not put plugin tables into , , or other core-owned databases. Storage Location Each enabled plugin receives a private state directory: Plugin databases live inside that directory. A plugin with one primary database should use: Plugins that need multiple independent stores may use additional database names: Database names should use the same safe identifier style as plugin ids: lowercase letters, numbers, and underscores. Core should reject path separators and traversal segments in database names. Core Contract Core exposes a narrow database API: The database handle should expose only core-owned plumbing: - : configured plugin-local database name. - : resolved database file path under the plugin state directory. - : SQLAlchemy-compatible SQLite URL. Plugins remain responsible for creating stores, engines, sessions, ORM models, and domain APIs from that URL. Core provides the location and migration lifecycle, not the schema. Migration Contract Plugins define schema changes as versioned migration files in the plugin package or repository. Alembic-style migrations are preferred because they are explicit, reviewable, ordered, and compatible with the existing Llama Pack persistence tooling. Core should extend the existing plugin migration metadata into an executable contract: A later CLI could wrap the same service. No core CLI is shipped yet: Migration status should include: - plugin id - target id - database URL or redacted database path - migration directory - current revision - head revision - status: , , , , or - last migration error, when available Startup should continue to report missing or pending plugin migrations as health warnings. Startup should not silently mutate plugin databases unless an explicit operator setting is added later. Ownership Boundary Core owns: - Resolving plugin database paths safely. - Ensuring plugin database files stay under the plugin state directory. - Providing SQLAlchemy-compatible URLs. - Registering migration targets. - Reporting migration status in plugin status endpoints. - Running explicit migration commands when requested. - Emitting migration lifecycle events such as pending, started, completed, and failed. Plugins own: - Tables, indexes, constraints, and migrations. - ORM models and store classes. - Reads, writes, validation, and domain behavior. - Plugin data retention and export semantics. - Tests that prove plugin migrations and stores work. This boundary keeps core generic. A paid add-on such as can store business identity, usage, quota, audit, and reporting data without making core aware of those models. Backup And Restore Separate plugin databases make backup and restore more predictable: - Core backups can include only core databases when operators want a clean core restore. - Full-instance backups can include when operators want plugin data restored too. - Paid/private plugin support can inspect plugin-owned databases without touching core runtime databases. - Plugin uninstall or reset workflows can remove a plugin state directory without schema surgery in core databases. The backup tooling should eventually expose plugin databases as named units, for example: Failure Handling Plugin database failures should degrade the plugin, not the core runtime. - If a plugin migration is missing or pending, the plugin remains enabled unless the plugin marks that migration as required for registration. - If explicit migration execution fails, core records the failure in plugin health/status and returns an operator-visible error. - If plugin store initialization fails during registration, that plugin should fail or disable itself through normal plugin registration error handling. - Core routes, auth, chat, and node management should continue to work when a plugin database is broken. Testing Expectations Core tests should cover: - Database path resolution stays inside plugin state directories. - Invalid database names are rejected. - Migration targets can be registered with plugin database URLs. - Migration status reports current, pending, missing, and failed targets. - Explicit migration execution affects only the selected plugin database. - Plugin database failures are reported in plugin status without breaking core startup. Plugin tests should cover: - Fresh database creation. - Migration from older revisions. - Store read/write behavior. - Plugin registration with missing, pending, and current schemas. - Backup/restore expectations for plugin-owned state when applicable.`},{id:`plugin-page-authoring-v1`,title:`Plugin Page Authoring v1`,sourcePath:`docs/plugin-page-authoring-v1.md`,content:`# Plugin Page Authoring v1

This document defines the v1 template-first plugin page model. The goal is to
make plugin UI authoring mostly HTML/CSS, with small JavaScript controllers for
dynamic behavior.

## Why

Current plugin pages are difficult to maintain when they rely on:

- large inline \`<style>\` blocks in JavaScript
- \`innerHTML\` injection for most rendering
- template HTML embedded as string literals

Template-first pages keep page structure in HTML fragments, styles in CSS files,
and dynamic behavior in focused controller modules.

## v1 Decisions

- \`frontend_api_version\` remains \`"1.0"\`.
- \`frontend.pages\` is the preferred source of plugin UI routes.
- \`frontend.pages\` replaces author-facing \`ui_routes\`; legacy \`ui_routes\`
  remains supported for existing plugins.
- Templates are HTML fragments, not full HTML documents.
- Templates, controllers, and styles live under \`frontend.static_dir\` and are
  served through \`/plugin-assets/{plugin_id}/...\`.
- Page controllers export \`mountPage(root, host)\`.
- Legacy \`frontend.entry\` modules exporting \`mount(container, host)\` remain
  supported.
- The stable host CSS class contract uses the \`lp-plugin-*\` prefix.

## Manifest Schema

\`\`\`yaml
id: llama_pack_business
name: Llama Pack Business
version: "1.0"
requires_core: "1.0"
backend_api_version: "1.0"
frontend_api_version: "1.0"
entrypoint: llama_pack_business.plugin:plugin

frontend:
  static_dir: llama_pack_business/static
  style_entries:
    - business.css
  pages:
    - route: /ui/plugins/llama_pack_business/overview
      template: templates/overview.html
      controller: controllers/overview.js
      title: Business Overview
    - route: /ui/plugins/llama_pack_business/documents
      template: templates/documents.html
      controller: controllers/documents.js
      title: Documents
\`\`\`

Rules:

- \`route\` must stay under \`/ui/plugins/{plugin_id}\`.
- \`template\`, \`controller\`, and \`style_entries\` are plugin asset paths. Relative
  paths are resolved under \`/plugin-assets/{plugin_id}/\`.
- Same-plugin \`/plugin-assets/{plugin_id}/...\` URLs are accepted.
- Cross-plugin asset URLs and traversal segments are rejected.
- \`frontend.static_dir\` is required when frontend assets are declared and must
  resolve inside the plugin root.
- \`controller\` is optional.
- \`title\` is used for route labels and page headings.

## Runtime Flow

1. The React shell resolves the current plugin route.
2. The shell matches it to \`frontend.pages[].route\`.
3. The shell fetches the page HTML fragment from \`template\`.
4. The shell inserts the fragment into the plugin container.
5. If \`controller\` is present, the shell imports it as an ES module and calls:

\`\`\`js
export function mountPage(root, host) {
  return () => {};
}
\`\`\`

Controllers should use event delegation on stable container nodes, submit forms
through \`host.api*\` helpers, and update dynamic values with DOM APIs such as
\`textContent\`, \`replaceChildren\`, and \`createElement\`.

Controllers should avoid writing full page markup with \`innerHTML\`, injecting
inline styles, or embedding large structural templates in JavaScript strings.

## Host CSS Contract

Core exposes these stable classes for plugin pages:

- \`lp-plugin-page\`
- \`lp-plugin-panel\`
- \`lp-plugin-header\`
- \`lp-plugin-title\`
- \`lp-plugin-muted\`
- \`lp-plugin-actions\`
- \`lp-plugin-button\`
- \`lp-plugin-field\`
- \`lp-plugin-input\`
- \`lp-plugin-table\`

Plugin-specific CSS may add local classes, but shared layout and control styling
should prefer the \`lp-plugin-*\` classes where they fit.

## Recommended Layout

\`\`\`text
plugins/llama_pack_business_plugin/
|-- plugin.yaml
\`-- llama_pack_business/
    |-- plugin.py
    \`-- static/
        |-- business.css
        |-- templates/
        |   |-- overview.html
        |   |-- identity.html
        |   |-- knowledge-bases.html
        |   \`-- documents.html
        \`-- controllers/
            |-- overview.js
            |-- identity.js
            |-- knowledge-bases.js
            \`-- documents.js
\`\`\`

## Backward Compatibility

Existing plugin frontend modules remain valid:

\`\`\`yaml
frontend:
  static_dir: hello_plugin/static
  entry: hello-entry.js
\`\`\`

Legacy modules still export:

\`\`\`js
export function mount(container, host) {
  return () => {};
}
\`\`\`

A plugin can migrate one route at a time by adding \`frontend.pages\` while legacy
plugins continue to use \`frontend.entry\`, \`navigation\`, \`secondary_navigation\`,
and \`ui_routes\`.

The checked-in \`plugins/hello_plugin/\` is the reference migrated sample: its
manifest declares \`frontend.pages\` and \`style_entries\`, and its page structure,
styles, and behavior live in \`static/templates/hello.html\`, \`static/hello.css\`,
and \`static/controllers/hello.js\`.

## Migration Guide

1. Move CSS from JavaScript strings to files under \`static/\`.
2. Split major sections into \`static/templates/*.html\` fragments.
3. Move dynamic behavior into \`static/controllers/*.js\`.
4. Replace full-page \`content.innerHTML = ...\` rendering with \`mountPage()\`
   controllers that update targeted nodes.
5. Declare routes in \`frontend.pages\` instead of authoring \`ui_routes\`.
`,headings:[{level:1,text:`Plugin Page Authoring v1`,anchor:`plugin-page-authoring-v1`},{level:2,text:`Why`,anchor:`why`},{level:2,text:`v1 Decisions`,anchor:`v1-decisions`},{level:2,text:`Manifest Schema`,anchor:`manifest-schema`},{level:2,text:`Runtime Flow`,anchor:`runtime-flow`},{level:2,text:`Host CSS Contract`,anchor:`host-css-contract`},{level:2,text:`Recommended Layout`,anchor:`recommended-layout`},{level:2,text:`Backward Compatibility`,anchor:`backward-compatibility`},{level:2,text:`Migration Guide`,anchor:`migration-guide`}],searchBody:`Plugin Page Authoring v1 This document defines the v1 template-first plugin page model. The goal is to make plugin UI authoring mostly HTML/CSS, with small JavaScript controllers for dynamic behavior. Why Current plugin pages are difficult to maintain when they rely on: - large inline blocks in JavaScript - injection for most rendering - template HTML embedded as string literals Template-first pages keep page structure in HTML fragments, styles in CSS files, and dynamic behavior in focused controller modules. v1 Decisions - remains . - is the preferred source of plugin UI routes. - replaces author-facing ; legacy remains supported for existing plugins. - Templates are HTML fragments, not full HTML documents. - Templates, controllers, and styles live under and are served through . - Page controllers export . - Legacy modules exporting remain supported. - The stable host CSS class contract uses the prefix. Manifest Schema Rules: - must stay under . - , , and are plugin asset paths. Relative paths are resolved under . - Same-plugin URLs are accepted. - Cross-plugin asset URLs and traversal segments are rejected. - is required when frontend assets are declared and must resolve inside the plugin root. - is optional. - is used for route labels and page headings. Runtime Flow 1. The React shell resolves the current plugin route. 2. The shell matches it to . 3. The shell fetches the page HTML fragment from . 4. The shell inserts the fragment into the plugin container. 5. If is present, the shell imports it as an ES module and calls: Controllers should use event delegation on stable container nodes, submit forms through helpers, and update dynamic values with DOM APIs such as , , and . Controllers should avoid writing full page markup with , injecting inline styles, or embedding large structural templates in JavaScript strings. Host CSS Contract Core exposes these stable classes for plugin pages: - - - - - - - - - - Plugin-specific CSS may add local classes, but shared layout and control styling should prefer the classes where they fit. Recommended Layout Backward Compatibility Existing plugin frontend modules remain valid: Legacy modules still export: A plugin can migrate one route at a time by adding while legacy plugins continue to use , , , and . The checked-in is the reference migrated sample: its manifest declares and , and its page structure, styles, and behavior live in , , and . Migration Guide 1. Move CSS from JavaScript strings to files under . 2. Split major sections into fragments. 3. Move dynamic behavior into . 4. Replace full-page rendering with controllers that update targeted nodes. 5. Declare routes in instead of authoring .`},{id:`plugins`,title:`Plugin Author Guide`,sourcePath:`docs/plugins.md`,content:`# Plugin Author Guide

Llama Pack plugins are trusted local Python packages loaded from configured
filesystem paths. The initial plugin runtime is intentionally local-path only:
there is no Python package entrypoint discovery, sandboxed execution, or remote
frontend JavaScript.

Use the checked-in \`plugins/hello_plugin/\` as the reference sample. Paid or
private plugins, including the private \`llama_pack_business\` add-on, live outside
this repository and are loaded from configured local paths.

For a draft of the next plugin-page developer experience (template-first pages,
external styles, and action-focused controllers), see
[Plugin Page Authoring v1 (Draft)](plugin-page-authoring-v1.md).

## Enable A Plugin

Add the plugin id to \`enabled_plugins\` and provide a matching \`plugins\` entry:

\`\`\`yaml
enabled_plugins:
  - hello_plugin

plugins:
  hello_plugin:
    path: ./plugins/hello_plugin
    enabled: true
    config:
      reject_chat: false
\`\`\`

Plugins whose id is not enabled, whose configured entry is disabled, or whose
runtime mode is incompatible are not registered. Failed and incompatible plugins
are reported through \`/lm-api/v1/plugins/status\`.

## Layout

Recommended local layout:

\`\`\`text
plugins/hello_plugin/
|-- plugin.yaml
\`-- hello_plugin/
    |-- __init__.py
    |-- plugin.py
    \`-- static/
        |-- hello.css
        |-- controllers/
        |   \`-- hello.js
        \`-- templates/
            \`-- hello.html
\`\`\`

The manifest \`entrypoint\` points at an object with a \`register(context)\` method.

## Manifest Reference

Required fields:

\`\`\`yaml
id: hello_plugin
name: Hello Plugin
version: "1.0"
requires_core: "1.0"
backend_api_version: "1.0"
frontend_api_version: "1.0"
entrypoint: hello_plugin.plugin:plugin
\`\`\`

Field rules:

- \`id\`: lowercase safe identifier matching \`^[a-z][a-z0-9_]*$\`.
- \`name\`: display name.
- \`version\`: plugin version string.
- \`requires_core\`, \`backend_api_version\`, \`frontend_api_version\`: currently
  use \`"1.0"\`.
- \`entrypoint\`: \`module.path:attribute\` import path relative to the plugin root.
- \`modes\`: optional list of \`agent\` and/or \`controller\`; defaults to both.
- \`description\`: optional text.
- \`frontend\`: optional static asset metadata.
- \`navigation\`, \`secondary_navigation\`, \`ui_routes\`: optional frontend route
  metadata.
- \`config_schema\`: optional validation schema for plugin config.

Example controller-only plugin:

\`\`\`yaml
modes:
  - controller
\`\`\`

## Config Schema

Plugins can declare a small config schema. Core validates config before plugin
registration; invalid config leaves the plugin disabled with a warning.

Supported field types:

- \`string\`
- \`integer\`
- \`number\`
- \`boolean\`

Example:

\`\`\`yaml
config_schema:
  properties:
    api_key:
      type: string
      secret: true
    max_items:
      type: integer
  required:
    - api_key
\`\`\`

Secret values are passed to plugin code through
\`context.get_plugin_config()\`, but are redacted as \`<redacted>\` in status
metadata. Do not log secrets from plugin code.

## Backend Extension API

Minimal plugin object:

\`\`\`python
from fastapi import APIRouter


class Plugin:
    def register(self, context):
        router = APIRouter()

        @router.get("/hello")
        async def hello():
            return {"message": "hello from plugin"}

        context.add_api_router(router)


plugin = Plugin()
\`\`\`

Available \`PluginContext\` methods:

- \`add_api_router(router, prefix=None)\`: registers backend routes under
  \`/lm-api/v1/plugins/{plugin_id}/...\`. The default prefix is \`/{plugin_id}\`.
  Custom prefixes must stay inside the plugin namespace and must not collide
  with another plugin route prefix.
- \`add_navigation_item(item)\`: appends primary frontend navigation metadata.
- \`add_secondary_navigation_item(item)\`: appends scoped secondary navigation
  metadata for plugin pages.
- \`add_ui_route(item)\`: appends placeholder frontend route metadata.
- \`subscribe(event_name, handler)\`: subscribes to in-process best-effort events.
- \`add_policy_hook(hook_name, handler)\`: registers a policy hook.
- \`add_health_check(handler)\`: registers a dynamic health check for
  \`/lm-api/v1/plugins/status\`.
- \`get_database(name="main")\`: returns a plugin-owned SQLite database handle
  rooted under \`{log_dir}/plugins/{plugin_id}/state/\`.
- \`add_migration_target(...)\`: registers plugin migration metadata and optional
  explicit migration execution for a plugin-owned database.
- \`get_plugin_config()\`: returns the plugin's configured config values.
- \`get_state_dir()\`: returns a \`Path\` for the plugin's private persistent state
  directory (\`{log_dir}/plugins/{plugin_id}/state/\`). The directory is **not**
  created automatically; the plugin must call \`mkdir(parents=True, exist_ok=True)\`
  before writing to it (or delegate that to a store class). Use this path to
  locate plugin-owned SQLite databases or other data files. The directory is
  scoped to the runtime \`log_dir\`, keeping plugin data alongside other app state.

## Events

Event subscribers receive an event envelope with stable metadata:

\`\`\`python
async def record_event(event):
    print(event.type, event.id, event.occurred_at)

context.subscribe("llama_pack.plugin.loaded", record_event)
\`\`\`

Subscriber failures and timeouts are isolated: they do not stop other
subscribers, but they are recorded in plugin health/status metadata.

Current built-in event names include:

- \`llama_pack.plugin.loaded\`
- \`llama_pack.plugin.disabled\`
- \`llama_pack.plugin.failed\`
- \`llama_pack.plugin.config.updated\`
- \`llama_pack.plugin.migration.pending\`
- \`llama_pack.plugin.migration.completed\`

## Hooks

Policy hooks run in deterministic registration order. Safety-sensitive hook
failures reject the action.

The initial hook is \`llama_pack.chat_admission\`. It runs through the shared
\`ChatScheduler\` admission path before scheduler capacity is consumed, so it
applies to native chat, OpenAI-compatible chat, Ollama-compatible chat, and
threaded chat surfaces that route through the scheduler.

Example:

\`\`\`python
async def chat_admission(payload):
    config = context.get_plugin_config()
    if config.get("reject_chat"):
        return {"allowed": False, "message": "Plugin rejected chat"}
    return {"allowed": True}

context.add_policy_hook("llama_pack.chat_admission", chat_admission)
\`\`\`

## Health Checks

Health checks can be sync or async. They may return one dict, a list of dicts,
or \`None\`.

\`\`\`python
async def health_check():
    return {"level": "ok", "message": "Plugin ready"}

context.add_health_check(health_check)
\`\`\`

Use \`level: "warning"\` or \`level: "error"\` for operator-visible issues.
Exceptions are caught and reported as health errors.

## Migration Metadata

Plugins can register migration targets for visibility:

\`\`\`python
database = context.get_database("main")
context.add_migration_target(
    "main",
    directory="hello_plugin/migrations",
    database=database,
)
\`\`\`

Core reports those targets at:

\`\`\`text
GET  /lm-api/v1/plugins/{plugin_id}/migrations/status
POST /lm-api/v1/plugins/{plugin_id}/migrations/{target_id}/upgrade
\`\`\`

Pending or missing migrations are also surfaced as warnings in
\`/lm-api/v1/plugins/status\`. Core does not run plugin migrations during startup;
migration execution is explicit through the plugin migration API.

Plugins that need durable data should use plugin-owned databases under their
private state directory, with plugin-owned schemas and migrations. Core provides
the storage location and migration lifecycle contract, but does not import
plugin models or place plugin tables in core databases. See
[Plugin Database Contract](plugin-databases.md).

## Frontend Metadata

The backend exposes enabled plugin metadata at:

\`\`\`text
GET /lm-api/v1/plugins/enabled
\`\`\`

For new plugin UI, prefer \`frontend.pages\`. Each page declares a core UI route,
an HTML fragment template under \`frontend.static_dir\`, an optional controller
module under \`frontend.static_dir\`, and a title.

Manifest example:

\`\`\`yaml
frontend:
  static_dir: hello_plugin/static
  style_entries:
    - hello.css
  pages:
    - route: /ui/plugins/hello_plugin
      template: templates/hello.html
      controller: controllers/hello.js
      title: Hello Plugin
\`\`\`

Core serves static files from the declared static directory under:

\`\`\`text
/plugin-assets/{plugin_id}/...
\`\`\`

The React shell renders plugin navigation, scoped secondary navigation, and a
generic plugin host page from \`frontend.pages\`. The host fetches the declared
HTML fragment, inserts it into the plugin container, then loads the optional
controller module and calls \`mountPage(root, host)\`.

Minimal page controller:

\`\`\`js
export function mountPage(root, host) {
  root.querySelector("[data-plugin-id]").textContent = host.pluginId;
  return () => {};
}
\`\`\`

Legacy plugins may still use \`frontend.entry\`:

\`\`\`yaml
frontend:
  static_dir: hello_plugin/static
  entry: hello-entry.js
navigation:
  - label: Hello
    path: /ui/plugins/hello_plugin
ui_routes:
  - path: /ui/plugins/hello_plugin
    label: Hello Plugin
\`\`\`

For legacy plugin routes, the host loads \`frontend.entry\` as an ES module and
calls its exported \`mount(container, host)\` function.

Minimal plugin frontend module:

\`\`\`js
export function mount(container, host) {
  container.textContent = \`Mounted \${host.pluginId}\`;
  return () => {
    container.textContent = "";
  };
}
\`\`\`

The \`host\` object exposes:

- \`pluginId\`: current plugin id.
- \`apiGet(path)\`, \`apiPost(path, body)\`, \`apiPut(path, body)\`, and
  \`apiDelete(path)\`: scoped helpers for \`/lm-api/v1/plugins/{plugin_id}\`.
- \`navigate(path)\`: navigate inside the core UI.
- \`refreshPluginStatus()\`: request a plugin status refresh.

Plugin frontend modules run in the core UI origin. Treat plugin frontend code as
trusted extension code and keep private/paid plugin UI in the private plugin
repository.

Core provides a small stable CSS class contract for plugin pages:

- \`lp-plugin-page\`
- \`lp-plugin-panel\`
- \`lp-plugin-header\`
- \`lp-plugin-title\`
- \`lp-plugin-muted\`
- \`lp-plugin-actions\`
- \`lp-plugin-button\`
- \`lp-plugin-field\`
- \`lp-plugin-input\`
- \`lp-plugin-table\`

Plugin assets are served with \`Cache-Control: no-store\`, and the React plugin
host appends a version/reload query string when importing plugin controllers,
styles, and legacy \`frontend.entry\` modules.
During development, plugin frontend asset changes should only require a browser
reload or the plugin page's Reload button. Core frontend rebuilds are only
needed when the public host contract changes.

The shell also reads \`/lm-api/v1/plugins/status\` and shows administrator-facing
alerts for failed, incompatible, warning, or error plugin states.

Administrators can inspect configured plugins at \`/ui/plugins\`. That page
shows plugin status, health, frontend metadata, redacted config metadata, and
registered migration targets.

## Testing Plugins

Backend plugin behavior should have focused tests in \`tests/test_plugins.py\`.
Use isolated fixture plugins for failure, collision, config, hook, event, and
migration edge cases. Use \`plugins/hello_plugin/\` as the checked-in integration
target for the happy path.

Recommended coverage:

- Core starts with no plugins.
- Enabled plugin registers metadata and routes.
- Disabled, failed, and incompatible plugins do not register routes.
- Route namespace and collision failures are reported.
- Static assets are served only from the declared static directory.
- Path traversal is rejected.
- Config schema validation disables invalid plugins.
- Secret config values are redacted from status metadata.
- Event and hook failures are isolated and reported.
- Health checks appear in \`/lm-api/v1/plugins/status\`.
- Migration metadata appears in \`/migrations/status\`.
- Pending or missing migrations produce health warnings.
- Plugin registration does not auto-run migrations.

Frontend plugin shell behavior is covered in \`frontend/src/components/AppShell.test.tsx\`.

## Hello Plugin Walkthrough

1. Enable \`hello_plugin\` in controller config:

   \`\`\`yaml
   enabled_plugins:
     - hello_plugin
   plugins:
     hello_plugin:
       path: ./plugins/hello_plugin
       enabled: true
       config:
         reject_chat: false
   \`\`\`

2. Start the controller.

3. Confirm backend route:

   \`\`\`bash
   curl http://127.0.0.1:9137/lm-api/v1/plugins/hello_plugin/hello
   \`\`\`

4. Confirm metadata:

   \`\`\`bash
   curl http://127.0.0.1:9137/lm-api/v1/plugins/enabled
   curl http://127.0.0.1:9137/lm-api/v1/plugins/status
   curl http://127.0.0.1:9137/lm-api/v1/plugins/hello_plugin/migrations/status
   \`\`\`

5. Open the React UI on the controller. The \`Hello\` nav item should appear in
   the \`Plugins\` section and route to a placeholder page.

6. Set \`reject_chat: true\` to exercise the \`llama_pack.chat_admission\` hook. Chat
   requests that route through \`ChatScheduler\` should be rejected before
   scheduler capacity is consumed.

## Private Plugin Repositories

Paid or private plugins should be tracked in separate private repositories.
Keep this repository focused on the core runtime, public extension contracts,
and the minimal \`hello_plugin\` sample. The \`llama_pack_business\` add-on is a paid
private plugin and should not become a core runtime dependency.

Recommended local development setup:

\`\`\`yaml
enabled_plugins:
  - llama_pack_business

plugins:
  llama_pack_business:
    path: /Users/robertsmith/Apps/llama-pack-business-plugin
    enabled: true
    config:
      organization_name: Acme
\`\`\`

That private plugin uses the same manifest schema, backend extension API,
frontend metadata contract, health checks, and migration metadata described
above. It should carry its own implementation tests and CI, while this
repository keeps fixture-based coverage for the generic plugin runtime and the
public \`hello_plugin\` sample.

Private plugins that provide end-user auth or chat policy, such as
\`llama_pack_business\`, should expose their client-facing availability through core
client discovery rather than requiring clients to scrape plugin status or know
private route details. Core discovery should advertise plugin auth endpoints
only when the plugin is enabled and not reporting errors that make the
advertised feature unusable.

## Deferred Work

These are not part of the current plugin foundation:

- Dynamic React \`import()\` of plugin frontend bundles.
- Frontend bundle failure isolation beyond backend status alerts.
- Remote plugin JavaScript or third-party asset origins.
- Sandboxed plugin Python or JavaScript execution.
- Auto-running plugin migrations on startup.
- Plugin install/update/uninstall lifecycle commands.
- Python package entrypoint discovery.
`,headings:[{level:1,text:`Plugin Author Guide`,anchor:`plugin-author-guide`},{level:2,text:`Enable A Plugin`,anchor:`enable-a-plugin`},{level:2,text:`Layout`,anchor:`layout`},{level:2,text:`Manifest Reference`,anchor:`manifest-reference`},{level:2,text:`Config Schema`,anchor:`config-schema`},{level:2,text:`Backend Extension API`,anchor:`backend-extension-api`},{level:2,text:`Events`,anchor:`events`},{level:2,text:`Hooks`,anchor:`hooks`},{level:2,text:`Health Checks`,anchor:`health-checks`},{level:2,text:`Migration Metadata`,anchor:`migration-metadata`},{level:2,text:`Frontend Metadata`,anchor:`frontend-metadata`},{level:2,text:`Testing Plugins`,anchor:`testing-plugins`},{level:2,text:`Hello Plugin Walkthrough`,anchor:`hello-plugin-walkthrough`},{level:2,text:`Private Plugin Repositories`,anchor:`private-plugin-repositories`},{level:2,text:`Deferred Work`,anchor:`deferred-work`}],searchBody:`Plugin Author Guide Llama Pack plugins are trusted local Python packages loaded from configured filesystem paths. The initial plugin runtime is intentionally local-path only: there is no Python package entrypoint discovery, sandboxed execution, or remote frontend JavaScript. Use the checked-in as the reference sample. Paid or private plugins, including the private add-on, live outside this repository and are loaded from configured local paths. For a draft of the next plugin-page developer experience (template-first pages, external styles, and action-focused controllers), see Plugin Page Authoring v1 (Draft). Enable A Plugin Add the plugin id to and provide a matching entry: Plugins whose id is not enabled, whose configured entry is disabled, or whose runtime mode is incompatible are not registered. Failed and incompatible plugins are reported through . Layout Recommended local layout: The manifest points at an object with a method. Manifest Reference Required fields: Field rules: - : lowercase safe identifier matching . - : display name. - : plugin version string. - , , : currently use . - : import path relative to the plugin root. - : optional list of and/or ; defaults to both. - : optional text. - : optional static asset metadata. - , , : optional frontend route metadata. - : optional validation schema for plugin config. Example controller-only plugin: Config Schema Plugins can declare a small config schema. Core validates config before plugin registration; invalid config leaves the plugin disabled with a warning. Supported field types: - - - - Example: Secret values are passed to plugin code through , but are redacted as in status metadata. Do not log secrets from plugin code. Backend Extension API Minimal plugin object: Available methods: - : registers backend routes under . The default prefix is . Custom prefixes must stay inside the plugin namespace and must not collide with another plugin route prefix. - : appends primary frontend navigation metadata. - : appends scoped secondary navigation metadata for plugin pages. - : appends placeholder frontend route metadata. - : subscribes to in-process best-effort events. - : registers a policy hook. - : registers a dynamic health check for . - : returns a plugin-owned SQLite database handle rooted under . - : registers plugin migration metadata and optional explicit migration execution for a plugin-owned database. - : returns the plugin's configured config values. - : returns a for the plugin's private persistent state directory ( ). The directory is not created automatically; the plugin must call before writing to it (or delegate that to a store class). Use this path to locate plugin-owned SQLite databases or other data files. The directory is scoped to the runtime , keeping plugin data alongside other app state. Events Event subscribers receive an event envelope with stable metadata: Subscriber failures and timeouts are isolated: they do not stop other subscribers, but they are recorded in plugin health/status metadata. Current built-in event names include: - - - - - - Hooks Policy hooks run in deterministic registration order. Safety-sensitive hook failures reject the action. The initial hook is . It runs through the shared admission path before scheduler capacity is consumed, so it applies to native chat, OpenAI-compatible chat, Ollama-compatible chat, and threaded chat surfaces that route through the scheduler. Example: Health Checks Health checks can be sync or async. They may return one dict, a list of dicts, or . Use or for operator-visible issues. Exceptions are caught and reported as health errors. Migration Metadata Plugins can register migration targets for visibility: Core reports those targets at: Pending or missing migrations are also surfaced as warnings in . Core does not run plugin migrations during startup; migration execution is explicit through the plugin migration API. Plugins that need durable data should use plugin-owned databases under their private state directory, with plugin-owned schemas and migrations. Core provides the storage location and migration lifecycle contract, but does not import plugin models or place plugin tables in core databases. See Plugin Database Contract. Frontend Metadata The backend exposes enabled plugin metadata at: For new plugin UI, prefer . Each page declares a core UI route, an HTML fragment template under , an optional controller module under , and a title. Manifest example: Core serves static files from the declared static directory under: The React shell renders plugin navigation, scoped secondary navigation, and a generic plugin host page from . The host fetches the declared HTML fragment, inserts it into the plugin container, then loads the optional controller module and calls . Minimal page controller: Legacy plugins may still use : For legacy plugin routes, the host loads as an ES module and calls its exported function. Minimal plugin frontend module: The object exposes: - : current plugin id. - , , , and : scoped helpers for . - : navigate inside the core UI. - : request a plugin status refresh. Plugin frontend modules run in the core UI origin. Treat plugin frontend code as trusted extension code and keep private/paid plugin UI in the private plugin repository. Core provides a small stable CSS class contract for plugin pages: - - - - - - - - - - Plugin assets are served with , and the React plugin host appends a version/reload query string when importing plugin controllers, styles, and legacy modules. During development, plugin frontend asset changes should only require a browser reload or the plugin page's Reload button. Core frontend rebuilds are only needed when the public host contract changes. The shell also reads and shows administrator-facing alerts for failed, incompatible, warning, or error plugin states. Administrators can inspect configured plugins at . That page shows plugin status, health, frontend metadata, redacted config metadata, and registered migration targets. Testing Plugins Backend plugin behavior should have focused tests in . Use isolated fixture plugins for failure, collision, config, hook, event, and migration edge cases. Use as the checked-in integration target for the happy path. Recommended coverage: - Core starts with no plugins. - Enabled plugin registers metadata and routes. - Disabled, failed, and incompatible plugins do not register routes. - Route namespace and collision failures are reported. - Static assets are served only from the declared static directory. - Path traversal is rejected. - Config schema validation disables invalid plugins. - Secret config values are redacted from status metadata. - Event and hook failures are isolated and reported. - Health checks appear in . - Migration metadata appears in . - Pending or missing migrations produce health warnings. - Plugin registration does not auto-run migrations. Frontend plugin shell behavior is covered in . Hello Plugin Walkthrough 1. Enable in controller config: 2. Start the controller. 3. Confirm backend route: 4. Confirm metadata: 5. Open the React UI on the controller. The nav item should appear in the section and route to a placeholder page. 6. Set to exercise the hook. Chat requests that route through should be rejected before scheduler capacity is consumed. Private Plugin Repositories Paid or private plugins should be tracked in separate private repositories. Keep this repository focused on the core runtime, public extension contracts, and the minimal sample. The add-on is a paid private plugin and should not become a core runtime dependency. Recommended local development setup: That private plugin uses the same manifest schema, backend extension API, frontend metadata contract, health checks, and migration metadata described above. It should carry its own implementation tests and CI, while this repository keeps fixture-based coverage for the generic plugin runtime and the public sample. Private plugins that provide end-user auth or chat policy, such as , should expose their client-facing availability through core client discovery rather than requiring clients to scrape plugin status or know private route details. Core discovery should advertise plugin auth endpoints only when the plugin is enabled and not reporting errors that make the advertised feature unusable. Deferred Work These are not part of the current plugin foundation: - Dynamic React of plugin frontend bundles. - Frontend bundle failure isolation beyond backend status alerts. - Remote plugin JavaScript or third-party asset origins. - Sandboxed plugin Python or JavaScript execution. - Auto-running plugin migrations on startup. - Plugin install/update/uninstall lifecycle commands. - Python package entrypoint discovery.`},{id:`setup`,title:`Setup`,sourcePath:`docs/setup.md`,content:`# Setup

This page covers installation, onboarding, admin keys, migrations, smoke checks,
and local test/build commands.

## Quick Start

Guided terminal setup for a fresh controller or agent:

\`\`\`bash
scripts/setup_llama_pack.sh
\`\`\`

The wizard asks whether the machine is a controller, agent, or single-machine
setup. It then runs dependency sync, onboarding, optional llama.cpp setup for
agents, and optional service startup.

Repeatable non-interactive controller setup:

\`\`\`bash
scripts/setup_llama_pack.sh \\
  --non-interactive \\
  --role controller \\
  --host 127.0.0.1 \\
  --port 9137 \\
  --start
\`\`\`

Repeatable non-interactive agent setup:

\`\`\`bash
scripts/setup_llama_pack.sh \\
  --non-interactive \\
  --role agent \\
  --node linux-2080ti \\
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \\
  --agent-url "$LLAMA_PACK_AGENT_URL" \\
  --controller-registration-key "$LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND" \\
  --llama-cpp-backend auto \\
  --start
\`\`\`

UI-first setup remains available for a fresh controller:

\`\`\`bash
uv sync
scripts/start_controller.sh
\`\`\`

Then open the web UI and follow **Setup**. On first run, the Setup Assistant
creates the first admin key before showing controller/agent guidance. The UI
does not write config files or run migrations in this version; it generates
script-backed commands and verifies backend, auth, mode, and node status after
login.

Script-first setup for a controller:

\`\`\`bash
uv sync
scripts/onboard_controller.sh
scripts/start_controller.sh
\`\`\`

Script-first setup for an agent:

\`\`\`bash
uv sync
scripts/install_llama_cpp.sh --backend auto
cp .llama_pack.env.example .llama_pack.env
# Edit .llama_pack.env before onboarding:
# - LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND must match the controller's
#   LLAMA_PACK_CONTROLLER_REGISTRATION_KEY from the controller .llama_pack.env.
# - LLAMA_PACK_CONTROLLER_URL should point at the controller.
# - LLAMA_PACK_AGENT_URL should be the URL the controller uses for this agent.
set -a
source .llama_pack.env
set +a
scripts/onboard_agent.sh \\
  --node linux-2080ti \\
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \\
  --agent-url "$LLAMA_PACK_AGENT_URL"
scripts/start_agent.sh
\`\`\`

The onboarding scripts write local secrets to \`.llama_pack.env\`, which is
ignored by git. The start/stop helper scripts source that file automatically.
For encrypted controller/agent traffic, set up Caddy before switching
\`LLAMA_PACK_CONTROLLER_URL\` and \`LLAMA_PACK_AGENT_URL\` to HTTPS; see
\`docs/caddy-local-tls.md\` for the operator checklist and
\`docs/tls-caddy-plan.md\` for the design rationale.

Two network exposure modes are supported:

- Direct LAN HTTP: set \`LLAMA_PACK_HOST=0.0.0.0\` and use \`http://<host>:9137\`
  URLs. This is simpler but sends API keys and traffic in plaintext.
- Caddy/local TLS: set \`LLAMA_PACK_HOST=127.0.0.1\` and use
  \`https://<host>.local\` URLs. Uvicorn is reachable only from the local
  machine, and Caddy is the LAN-facing listener.

Manual setup remains available:

\`\`\`bash
uv sync
cp config.example.yaml config.yaml
export LLAMA_PACK_CONFIG=config.yaml
alembic -x db=controller upgrade controller@head
alembic -x db=auth upgrade auth@head
alembic -x db=audit upgrade audit@head
alembic -x db=chat_sessions upgrade chat_sessions@head
alembic -x db=downloads upgrade downloads@head
alembic -x db=benchmarks upgrade benchmarks@head
uv run python -m llama_pack.auth --config config.yaml create-admin {user_name}
LLAMA_PACK_CONFIG=config.yaml uvicorn llama_pack.main:app --host 127.0.0.1 --port 9000
\`\`\`

\`uv sync\` is the recommended install path because this repository includes a
lockfile. It also avoids shell-specific ambiguity where \`python\` may not exist
or \`pip\` may resolve to something other than CPython pip. If you need a
pip-based editable install, use an explicit supported interpreter:

\`\`\`bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
\`\`\`

Or use the helper scripts:

\`\`\`bash
scripts/start_agent.sh
scripts/start_agent_stack.sh
scripts/stop_server.sh
\`\`\`

## Onboarding Scripts

Onboard a fresh controller without manually copying config or generating keys:

\`\`\`bash
scripts/onboard_controller.sh
\`\`\`

The controller onboarding script writes local secrets to \`.llama_pack.env\`,
including \`LLAMA_PACK_CONTROLLER_REGISTRATION_KEY\` and the first generated
admin API key when migrations are enabled.

To enable controller semantic memory during the same setup step:

\`\`\`bash
scripts/onboard_controller.sh --enable-memory
\`\`\`

That installs the \`controller-memory\` extras, downloads the default embedding
model to \`./models/embedding/all-MiniLM-L6-v2\`, writes a working \`memory:\`
block to the controller config, and records \`LLAMA_PACK_MEMORY_MODEL_PATH\` in
\`.llama_pack.env\`. Use \`--memory-model-path PATH\` or \`--memory-store-path PATH\`
to choose different local paths.

Onboard a fresh agent:

\`\`\`bash
scripts/install_llama_cpp.sh --backend auto
cp .llama_pack.env.example .llama_pack.env
# Edit .llama_pack.env and set LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND
# to the controller's LLAMA_PACK_CONTROLLER_REGISTRATION_KEY.
set -a
source .llama_pack.env
set +a
scripts/onboard_agent.sh \\
  --node linux-2080ti \\
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \\
  --agent-url "$LLAMA_PACK_AGENT_URL"
\`\`\`

The agent onboarding script keeps \`controller_url\` and \`agent_url\` as
environment placeholders in the generated config, and writes the real LAN URLs
to \`.llama_pack.env\` alongside the agent API key, controller registration
key, config path, host, and port. \`scripts/start_agent.sh\` and
\`scripts/stop_server.sh\` source \`.llama_pack.env\` automatically.

To make agent setup closer to one command, let onboarding install llama.cpp
first:

\`\`\`bash
scripts/onboard_agent.sh \\
  --node linux-2080ti \\
  --controller-url "$LLAMA_PACK_CONTROLLER_URL" \\
  --agent-url "$LLAMA_PACK_AGENT_URL" \\
  --install-llama-cpp \\
  --llama-cpp-backend auto
\`\`\`

\`scripts/install_llama_cpp.sh --backend auto\` picks Metal on Apple Silicon,
CUDA when \`nvcc\` is available, and CPU otherwise. Use \`--backend cuda\`,
\`--backend metal\`, or \`--backend cpu\` to force a specific build. The installer
prints the matching \`llama_server_bin\`, \`llama_cpp_dir\`, and \`python_bin\`
values after it verifies \`llama-server\`, \`llama-quantize\`, the converter, and
the llama.cpp Python venv.

The controller registration key comes from the controller machine's
\`.llama_pack.env\` after \`scripts/onboard_controller.sh\` runs:

\`\`\`bash
grep LLAMA_PACK_CONTROLLER_REGISTRATION_KEY .llama_pack.env
\`\`\`

Copy that value to each agent as
\`LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND\`.

Regenerate a local key and print the matching update for the other machines:

\`\`\`bash
scripts/regenerate_key.sh --type controller-registration
scripts/regenerate_key.sh --type agent-api --node linux-2080ti --agent-url "$LLAMA_PACK_AGENT_URL"
\`\`\`

Script defaults:

\`\`\`text
LLAMA_PACK_HOST=127.0.0.1
LLAMA_PACK_PORT=9137
LLAMA_PACK_CONFIG=./config.yaml if present, otherwise ./config.example.yaml
\`\`\`

## First Admin Key

Llama Pack fails closed until you create an admin key or configure
\`agent_api_key\`. \`scripts/onboard_controller.sh\` creates the first admin key
for fresh controller setup and stores it in \`.llama_pack.env\`.

For manual setup, create the first admin key from the terminal:

\`\`\`bash
uv run python -m llama_pack.auth --config config.yaml create-admin {user_name}
\`\`\`

The command stores a hashed key in \`log_dir/auth_store.db\` and prints the raw API key once. Use that key in the UI login form, or send it as \`X-Llama-Manager-Key\` for API requests. To create more keys later, log in as an admin and use the auth key management UI/API.

There is no built-in \`dev\` login fallback. For local development, create a throwaway admin key with the same command.

For static shared secrets in agent/controller config, prefer the onboarding or
rotation scripts:

\`\`\`bash
scripts/onboard_controller.sh
scripts/onboard_agent.sh --controller-url "$LLAMA_PACK_CONTROLLER_URL" --agent-url "$LLAMA_PACK_AGENT_URL"
scripts/regenerate_key.sh --type controller-registration
scripts/regenerate_key.sh --type agent-api --node linux-2080ti --agent-url "$LLAMA_PACK_AGENT_URL"
\`\`\`

For one-off manual values, generate a strong URL-safe value with:

\`\`\`bash
scripts/generate_api_key.py
\`\`\`

Use the printed value for matching config fields such as \`agent_api_key\`, \`nodes.<name>.api_key\`, \`controller_registration_key\`, and \`controller_registration_key_outbound\`.

## Linux Agent Smoke Test

Linux agent smoke test for the \`linux-2080ti\` setup:

\`\`\`bash
export LLAMA_PACK_AGENT_API_KEY=...
export LLAMA_PACK_CONTROLLER_REGISTRATION_KEY_OUTBOUND=...
# Required if the controller protects GET /nodes with an admin/API key:
export LLAMA_PACK_CONTROLLER_API_KEY=...
scripts/linux_agent_smoke.py --config linux-agent.config.example.yaml
\`\`\`

The smoke test validates the Linux agent config and runtime paths, starts the agent with that config, checks the agent \`/health\`, and waits until the controller lists the expected node with a fresh heartbeat. Add \`--stop-after-check\` if you want the script to stop the agent after a successful run.

## Schema Migrations

Run migration upgrades before starting the app or creating admin keys.

Persistence is now Alembic-managed and SQLAlchemy-backed across all app
databases.

Alembic is scaffolded with multiple DB targets:

- \`controller\`
- \`auth\`
- \`audit\`
- \`chat_sessions\`
- \`downloads\`
- \`benchmarks\`

Select a target via \`-x db=<target>\`.

Examples:

\`\`\`bash
alembic -x db=controller current
alembic -x db=auth revision -m "auth change" --version-path migrations/versions/auth
alembic -x db=audit upgrade audit@head
alembic -x db=chat_sessions downgrade -1
alembic -x db=downloads upgrade downloads@head
alembic -x db=benchmarks upgrade benchmarks@head
alembic -x db=controller stamp controller@head
\`\`\`

If \`-x db=\` is omitted, target defaults to \`controller\`. Use target-qualified heads such as \`auth@head\`; unqualified \`head\` is ambiguous because each database target has its own Alembic branch.

## Testing

Full test suite:

\`\`\`bash
uv run pytest -v
\`\`\`

The pytest suite installs \`frontend\` dependencies with \`npm ci\` before
running the React frontend unit tests, so \`frontend/node_modules\` does not need
to be checked in.

React frontend unit tests:

\`\`\`bash
cd frontend
npm ci
npm test
\`\`\`

React production build:

\`\`\`bash
cd frontend
npm run build
\`\`\`

The Vite build writes static assets to \`llama_pack/ui/react\`, which is
included in Python package data for release builds.

Frontend development workflow:

- [Frontend](frontend.md)
- \`scripts/start_controller_stack.sh\` starts the controller backend + React Vite dev server, or reports that the stack is currently up.
- \`scripts/start_agent_stack.sh\` starts the agent backend + React Vite dev server, or reports that the stack is currently up.
- \`scripts/dev_fullstack.sh\` starts backend + React Vite dev server in one command and auto-detects agent/controller mode from config.
- \`LLAMA_PACK_START_FRONTEND=1 scripts/start_controller.sh\` starts the
  backend and the React Vite dev server together for local development.
- \`scripts/start_frontend.sh\` starts only the React Vite dev server when a
  backend is already running.
`,headings:[{level:1,text:`Setup`,anchor:`setup`},{level:2,text:`Quick Start`,anchor:`quick-start`},{level:2,text:`Onboarding Scripts`,anchor:`onboarding-scripts`},{level:2,text:`First Admin Key`,anchor:`first-admin-key`},{level:2,text:`Linux Agent Smoke Test`,anchor:`linux-agent-smoke-test`},{level:2,text:`Schema Migrations`,anchor:`schema-migrations`},{level:2,text:`Testing`,anchor:`testing`}],searchBody:`Setup This page covers installation, onboarding, admin keys, migrations, smoke checks, and local test/build commands. Quick Start Guided terminal setup for a fresh controller or agent: The wizard asks whether the machine is a controller, agent, or single-machine setup. It then runs dependency sync, onboarding, optional llama.cpp setup for agents, and optional service startup. Repeatable non-interactive controller setup: Repeatable non-interactive agent setup: UI-first setup remains available for a fresh controller: Then open the web UI and follow Setup. On first run, the Setup Assistant creates the first admin key before showing controller/agent guidance. The UI does not write config files or run migrations in this version; it generates script-backed commands and verifies backend, auth, mode, and node status after login. Script-first setup for a controller: Script-first setup for an agent: The onboarding scripts write local secrets to , which is ignored by git. The start/stop helper scripts source that file automatically. For encrypted controller/agent traffic, set up Caddy before switching and to HTTPS; see for the operator checklist and for the design rationale. Two network exposure modes are supported: - Direct LAN HTTP: set and use URLs. This is simpler but sends API keys and traffic in plaintext. - Caddy/local TLS: set and use URLs. Uvicorn is reachable only from the local machine, and Caddy is the LAN-facing listener. Manual setup remains available: is the recommended install path because this repository includes a lockfile. It also avoids shell-specific ambiguity where may not exist or may resolve to something other than CPython pip. If you need a pip-based editable install, use an explicit supported interpreter: Or use the helper scripts: Onboarding Scripts Onboard a fresh controller without manually copying config or generating keys: The controller onboarding script writes local secrets to , including and the first generated admin API key when migrations are enabled. To enable controller semantic memory during the same setup step: That installs the extras, downloads the default embedding model to , writes a working block to the controller config, and records in . Use or to choose different local paths. Onboard a fresh agent: The agent onboarding script keeps and as environment placeholders in the generated config, and writes the real LAN URLs to alongside the agent API key, controller registration key, config path, host, and port. and source automatically. To make agent setup closer to one command, let onboarding install llama.cpp first: picks Metal on Apple Silicon, CUDA when is available, and CPU otherwise. Use , , or to force a specific build. The installer prints the matching , , and values after it verifies , , the converter, and the llama.cpp Python venv. The controller registration key comes from the controller machine's after runs: Copy that value to each agent as . Regenerate a local key and print the matching update for the other machines: Script defaults: First Admin Key Llama Pack fails closed until you create an admin key or configure . creates the first admin key for fresh controller setup and stores it in . For manual setup, create the first admin key from the terminal: The command stores a hashed key in and prints the raw API key once. Use that key in the UI login form, or send it as for API requests. To create more keys later, log in as an admin and use the auth key management UI/API. There is no built-in login fallback. For local development, create a throwaway admin key with the same command. For static shared secrets in agent/controller config, prefer the onboarding or rotation scripts: For one-off manual values, generate a strong URL-safe value with: Use the printed value for matching config fields such as , , , and . Linux Agent Smoke Test Linux agent smoke test for the setup: The smoke test validates the Linux agent config and runtime paths, starts the agent with that config, checks the agent , and waits until the controller lists the expected node with a fresh heartbeat. Add if you want the script to stop the agent after a successful run. Schema Migrations Run migration upgrades before starting the app or creating admin keys. Persistence is now Alembic-managed and SQLAlchemy-backed across all app databases. Alembic is scaffolded with multiple DB targets: - - - - - - Select a target via . Examples: If is omitted, target defaults to . Use target-qualified heads such as ; unqualified is ambiguous because each database target has its own Alembic branch. Testing Full test suite: The pytest suite installs dependencies with before running the React frontend unit tests, so does not need to be checked in. React frontend unit tests: React production build: The Vite build writes static assets to , which is included in Python package data for release builds. Frontend development workflow: - Frontend - starts the controller backend + React Vite dev server, or reports that the stack is currently up. - starts the agent backend + React Vite dev server, or reports that the stack is currently up. - starts backend + React Vite dev server in one command and auto-detects agent/controller mode from config. - starts the backend and the React Vite dev server together for local development. - starts only the React Vite dev server when a backend is already running.`}];function Mx(e){return e.get(`doc`)||``}function Nx(e){return jx.find(t=>t.id===e)||jx[0]}function Px(e){if(!e.trim())return jx;let t=e.toLowerCase();return jx.filter(e=>e.title.toLowerCase().includes(t)||e.sourcePath.toLowerCase().includes(t)||e.searchBody.toLowerCase().includes(t)||e.headings.some(e=>e.text.toLowerCase().includes(t)))}function Fx(e,t){if(!t.trim())return``;let n=t.toLowerCase(),r=e.searchBody.toLowerCase().indexOf(n);if(r===-1)return``;let i=Math.max(0,r-40),a=Math.min(e.searchBody.length,r+t.length+80),o=i>0?`…`:``,s=a<e.searchBody.length?`…`:``;return`${o}${e.searchBody.slice(i,a)}${s}`}function Ix(){let[e,t]=ni(),[n,r]=(0,v.useState)(``),i=Mx(e),a=(0,v.useMemo)(()=>Nx(i),[i]),o=(0,v.useMemo)(()=>Px(n),[n]);function s(e){r(``),t(t=>{let n=new URLSearchParams(t);return n.set(`doc`,e),n})}return(0,R.jsxs)(`div`,{className:`docs-shell`,children:[(0,R.jsxs)(`aside`,{className:`docs-sidebar`,"aria-label":`Documentation navigation`,children:[(0,R.jsxs)(`div`,{className:`docs-brand`,children:[(0,R.jsx)(Jr,{to:`/ui/setup`,className:`docs-back-link`,children:`← Back to app`}),(0,R.jsx)(`h1`,{className:`docs-brand-title`,children:`Llama Pack Docs`})]}),(0,R.jsxs)(`div`,{className:`docs-search-wrap`,children:[(0,R.jsx)(`label`,{htmlFor:`docs-search`,className:`docs-search-label`,children:`Search docs`}),(0,R.jsx)(`input`,{id:`docs-search`,type:`search`,className:`docs-search-input`,placeholder:`Search…`,value:n,onChange:e=>r(e.target.value),"aria-label":`Search docs`})]}),(0,R.jsx)(`nav`,{className:`docs-nav`,"aria-label":`Document list`,children:o.length===0?(0,R.jsxs)(`p`,{className:`docs-nav-empty`,children:[`No results for "`,n,`"`]}):o.map(e=>(0,R.jsxs)(`div`,{className:`docs-nav-item-wrap`,children:[(0,R.jsxs)(`button`,{type:`button`,className:`docs-nav-button ${e.id===a.id&&!n?`active`:``}`,onClick:()=>s(e.id),"aria-current":e.id===a.id&&!n?`page`:void 0,children:[(0,R.jsx)(`span`,{className:`docs-nav-title`,children:e.title}),(0,R.jsx)(`span`,{className:`docs-nav-path`,children:e.sourcePath}),n&&Fx(e,n)?(0,R.jsx)(`span`,{className:`docs-nav-snippet`,children:Fx(e,n)}):null]}),e.id===a.id&&!n&&e.headings.length>0?(0,R.jsx)(`ul`,{className:`docs-toc`,"aria-label":`Table of contents`,children:e.headings.filter(e=>e.level<=3).map(e=>(0,R.jsx)(`li`,{className:`docs-toc-level-${e.level}`,children:(0,R.jsx)(`a`,{href:`#${e.anchor}`,className:`docs-toc-link`,children:e.text})},`${e.anchor}-${e.level}`))}):null]},e.id))}),jx.length===0?(0,R.jsxs)(`p`,{className:`docs-empty-state`,children:[`No public docs were generated. Run `,(0,R.jsx)(`code`,{children:`node scripts/generate-docs.mjs`}),` and rebuild.`]}):null]}),(0,R.jsx)(`main`,{className:`docs-main`,"aria-label":`Documentation content`,children:jx.length===0?(0,R.jsxs)(`div`,{className:`docs-empty-main`,children:[(0,R.jsx)(`h2`,{children:`No docs available`}),(0,R.jsx)(`p`,{children:`Run the docs generator and rebuild the frontend to see documentation here.`})]}):(0,R.jsx)(`article`,{className:`docs-article`,"aria-label":a.title,children:(0,R.jsx)(Ev,{remarkPlugins:[Ax],disallowedElements:[`script`,`iframe`,`object`,`embed`],unwrapDisallowed:!0,components:{h1:({children:e})=>(0,R.jsx)(`h1`,{id:Lx(String(e)),children:e}),h2:({children:e})=>(0,R.jsx)(`h2`,{id:Lx(String(e)),children:e}),h3:({children:e})=>(0,R.jsx)(`h3`,{id:Lx(String(e)),children:e}),h4:({children:e})=>(0,R.jsx)(`h4`,{id:Lx(String(e)),children:e}),h5:({children:e})=>(0,R.jsx)(`h5`,{id:Lx(String(e)),children:e}),h6:({children:e})=>(0,R.jsx)(`h6`,{id:Lx(String(e)),children:e})},children:a.content})})})]})}function Lx(e){return e.toLowerCase().replace(/[^\w\s-]/g,``).trim().replace(/[\s_]+/g,`-`).replace(/-+/g,`-`)}function Rx(){return(0,R.jsx)(Xe,{children:(0,R.jsx)(_e,{children:(0,R.jsx)(Gr,{children:(0,R.jsx)(Si,{children:(0,R.jsx)(Fi,{children:(0,R.jsx)(Ti,{children:(0,R.jsx)(nr,{children:(0,R.jsxs)(er,{element:(0,R.jsx)(Ki,{}),children:[(0,R.jsxs)(er,{element:(0,R.jsx)(la,{}),children:[(0,R.jsx)(er,{path:`/`,element:(0,R.jsx)(oo,{})}),(0,R.jsx)(er,{path:`/ui/chat`,element:(0,R.jsx)(as,{})}),(0,R.jsx)(er,{path:`/ui/setup`,element:(0,R.jsx)(ec,{})}),(0,R.jsx)(er,{path:`/ui/nodes`,element:(0,R.jsx)(ic,{})}),(0,R.jsx)(er,{path:`/ui/gguf-library`,element:(0,R.jsx)(gc,{})}),(0,R.jsx)(er,{path:`/ui/hf-to-gguf`,element:(0,R.jsx)(Cc,{})}),(0,R.jsx)(er,{path:`/ui/hf-downloads`,element:(0,R.jsx)(sl,{})}),(0,R.jsx)(er,{path:`/ui/quantization`,element:(0,R.jsx)(wl,{})}),(0,R.jsx)(er,{path:`/ui/controller-ops`,element:(0,R.jsx)(jl,{})}),(0,R.jsx)(er,{path:`/ui/embeddings`,element:(0,R.jsx)(J,{})}),(0,R.jsx)(er,{path:`/ui/runtime`,element:(0,R.jsx)(ql,{})}),(0,R.jsx)(er,{path:`/ui/tool-loop-evals`,element:(0,R.jsx)(Pu,{})}),(0,R.jsx)(er,{path:`/ui/audit`,element:(0,R.jsx)(Uu,{})}),(0,R.jsx)(er,{path:`/ui/benchmarks`,element:(0,R.jsx)(cd,{})}),(0,R.jsx)(er,{path:`/ui/api-keys`,element:(0,R.jsx)(vd,{})}),(0,R.jsx)(er,{path:`/ui/plugins`,element:(0,R.jsx)(wd,{})}),(0,R.jsx)(er,{path:`/ui/plugins/:pluginId/*`,element:(0,R.jsx)(Ad,{})}),(0,R.jsx)(er,{path:`/ui/settings`,element:(0,R.jsx)(Fd,{})})]}),(0,R.jsx)(er,{path:`/ui/docs`,element:(0,R.jsx)(Ix,{})}),(0,R.jsx)(er,{path:`/ui/test-chat`,element:(0,R.jsx)(Gd,{})})]})})})})})})})})}y.createRoot(document.getElementById(`root`)).render((0,R.jsx)(v.StrictMode,{children:(0,R.jsx)(Rx,{})}));