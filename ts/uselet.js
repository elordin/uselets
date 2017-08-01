"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var USELET_MESSAGE_TYPE = 'uselet';
var IUselet = (function () {
    function IUselet() {
    }
    IUselet.prototype.and = function (that) {
        return IUselet.and(this, that);
    };
    IUselet.prototype.in = function (that) {
        return IUselet.in(this, that);
    };
    IUselet.in = function (u, node) {
        var ret = {
            and: function (that) {
                return IUselet.and(ret, that);
            },
            in: function (that) { return IUselet.in(ret, that); },
        };
        u.xml.forEach(function (x) { return node.appendChild(x); });
        Object.defineProperty(ret, 'xml', {
            get: function () { return [node]; },
            enumerable: true,
        });
        return ret;
    };
    IUselet.and = function (u1, u2) {
        if (!u2) {
            return u1;
        }
        var ret = {
            and: function (other) {
                return IUselet.and(ret, other);
            },
            in: function (other) {
                return IUselet.in(ret, other);
            },
        };
        Object.defineProperty(ret, 'xml', {
            get: function () { return u1.xml.concat(u2.xml); },
            enumerable: true,
        });
        return ret;
    };
    return IUselet;
}());
var Uselet = (function (_super) {
    __extends(Uselet, _super);
    function Uselet(name, model, update, view) {
        var _this = _super.call(this) || this;
        _this.name = name;
        _this.model = model;
        _this.update = update;
        _this.view = view;
        _this.address = '0';
        _this.root = document.createElement(name);
        Object.defineProperty(_this.root, 'uselet', {
            get: function () { return _this; },
            enumerable: true,
        });
        var child = view(model);
        child.xml.forEach(function (x) { return _this.root.appendChild(x); });
        _this.root.addEventListener(USELET_MESSAGE_TYPE, function (e) {
            _this.receive(e.detail);
        }, true);
        return _this;
    }
    Uselet.prototype.receive = function (msg) {
        var _this = this;
        if (!msg.type) {
            throw new Error('Untyped message received');
        }
        var oldModel = JSON.parse(JSON.stringify(this.model));
        this.model = this.update(this.model, msg);
        this.root.innerHTML = '';
        var child = this.view(this.model);
        child.xml.forEach(function (x) { return _this.root.appendChild(x); });
    };
    Object.defineProperty(Uselet.prototype, "xml", {
        get: function () {
            return [this.root];
        },
        enumerable: true,
        configurable: true
    });
    return Uselet;
}(IUselet));
var TextUselet = (function (_super) {
    __extends(TextUselet, _super);
    function TextUselet(str) {
        var _this = _super.call(this) || this;
        _this.str = str;
        return _this;
    }
    Object.defineProperty(TextUselet.prototype, "xml", {
        get: function () {
            return [document.createTextNode(this.str)];
        },
        enumerable: true,
        configurable: true
    });
    return TextUselet;
}(IUselet));
var XmlUselet = (function (_super) {
    __extends(XmlUselet, _super);
    function XmlUselet(input) {
        var _this = _super.call(this) || this;
        if (typeof input === 'string') {
            var dummy = document.createElement('div');
            dummy.innerHTML = input;
            _this.children = Array.prototype.map.call(dummy.childNodes, function (a) { return a; });
        }
        else {
            _this.children = input;
        }
        var ros = Array.prototype.map.call(document.querySelectorAll('router-outlet'), function (a) { return a; });
        _this.children.forEach(function (x) {
            if (x instanceof HTMLElement) {
                Array.prototype.forEach.call(x.querySelectorAll('[uref]'), function (node) {
                    var url = node.getAttribute('uref');
                    if (url) {
                        node.addEventListener('click', function (e) {
                            e.preventDefault();
                            ros.forEach(function (ro) { return ro.uselet.receive({ type: 'NAVIGATE', data: { url: url } }); });
                        });
                    }
                });
            }
        });
        return _this;
    }
    Object.defineProperty(XmlUselet.prototype, "xml", {
        get: function () {
            return this.children;
        },
        enumerable: true,
        configurable: true
    });
    return XmlUselet;
}(IUselet));
var UseletApp = (function () {
    function UseletApp(child, parent) {
        child.xml.forEach(function (x) { return (parent || document.body).appendChild((x)); });
    }
    return UseletApp;
}());
var ApiService = (function () {
    function ApiService() {
        var _this = this;
        this.address = 'API';
        window.addEventListener(USELET_MESSAGE_TYPE, function (e) {
            _this.receive(e.detail);
        });
    }
    ApiService.prototype.receive = function (msg) {
        switch (msg.type) {
            case 'GET_SOME':
                var pr = this.getSomething();
                console.info(pr);
                pr
                    .then(function (something) {
                    console.info('then');
                    broadcast('GOT_SOME', something);
                })
                    .catch(function (fail) { return broadcast('GET_FAILED'); });
                break;
            default:
        }
    };
    ApiService.prototype.getSomething = function () {
        return this.ajax('GET', 'http://localhost:8000/');
    };
    ApiService.prototype.ajax = function (method, uri, payload) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.addEventListener('readystatechange', function (e) {
                if (xhr.readyState === 4) {
                    if (xhr.status < 400) {
                        resolve(xhr.response);
                    }
                    else {
                        reject(xhr);
                    }
                }
            });
            xhr.open(method, uri);
            xhr.send(payload);
        });
    };
    return ApiService;
}());
var RouterOutlet = (function (_super) {
    __extends(RouterOutlet, _super);
    function RouterOutlet(patterns) {
        var _this = _super.call(this, 'router-outlet', window.location.pathname, function (model, msg) {
            switch (msg.type) {
                case 'NAVIGATE':
                    history.pushState({}, '', msg.data.url);
                    return msg.data.url;
                default:
                    return model;
            }
        }, function (path) {
            for (var i = 0; i < patterns.length; i++) {
                if (patterns[i].path.test(path.slice(1))) {
                    var cont = patterns[i].content;
                    if (typeof cont === 'function') {
                        var args = path.slice(1).match(patterns[i].path);
                        return args ? cont.apply(void 0, args) : cont();
                    }
                    else {
                        return cont;
                    }
                }
            }
            throw new Error('Not path match found for ' + path);
        }) || this;
        window.addEventListener('popstate', function (e) {
            _this.receive({ type: 'NAVIGATE', data: { url: location.pathname } });
        });
        return _this;
    }
    return RouterOutlet;
}(Uselet));
function broadcast(messageType, data) {
    window.dispatchEvent(new CustomEvent(USELET_MESSAGE_TYPE, { detail: { type: messageType, data: data || null } }));
}
Object.defineProperty(Node.prototype, 'addMessageEmitter', {
    value: function (eventType, messageType, data) {
        this.addEventListener(eventType, function (e) { return broadcast(messageType, data); });
    },
    writable: false,
});
window.addEventListener(USELET_MESSAGE_TYPE, function (e) { return console.info('BC', e.detail); }, true);
//# sourceMappingURL=uselet.js.map