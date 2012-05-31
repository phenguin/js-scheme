// Easy prototype inheritance
if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        var F = function () {};
        F.prototype = o;
        return new F();
    };
}

// Give constructors a way to add methods to their objects
Function.prototype.method = function (name, func) {
    if (!this.prototype[name]) {
        this.prototype[name] = func;
        return this;
    }
};

Array.method('last', function () {
    return this[this.length - 1];
});
Array.method('head', function () {
    return this[0];
});
Array.method('tail', function () {
    return this.slice(1);
});
String.method('last', function () {
    return this[this.length - 1];
});
String.method('head', function () {
    return this[0];
});
String.method('tail', function () {
    return this.slice(1);
});

var is_array = function (value) {
    return Object.prototype.toString.apply(value) === '[object Array]';
};

// Give currying to all functions
Function.method('curry', function () {
    var slice = Array.prototype.slice;
    var supplied = slice.apply(arguments);
    var that = this;
    return function () {
        return that.apply(null, supplied.concat(slice.apply(arguments)));
    };
});

function consumeNext (partial, rest) {
    var new_partial;
    var new_rest;

    // Don't care about whitespace
    while (rest[0] === " ")
        rest = rest.slice(1);

    if (rest === "") // Idempotent when done
        return [partial, rest];

    // Have to find the end of the S-expr
    if (rest[0] == "(") 
        return consumeSExpr(partial,rest);
    // Not a sub expression, just a symbol
    else 
        return consumeSimple(partial,rest);

    function consumeSimple (consumed, remaining) { // Parse a single symbol
        
        var j = remaining.indexOf(" ");
        var token;
        if (j == -1) {
            new_partial = consumed.concat(tokenType(remaining));
            new_rest = "";
        } 
        else {
            token = remaining.slice(0,j);

            new_partial = consumed.concat(tokenType(token));
            new_rest = remaining.slice(j);
        }
        return [new_partial, new_rest];
    }
    function consumeSExpr (consumed, remaining) { // Parse a subexpression
        var left = 1;
        var right = 0;
        var i = 1;

        // While unmatched parens..
        while ((right != left) && i < remaining.length) {
            if (remaining[i] == "(")
                left++;
            else if (remaining[i] == ")")
                right++;
            i++;
        }

        // If we matched the parenthesis
        if (right == left) {
            new_partial = consumed.concat([tokenize(remaining.slice(0,i))]);
            new_rest = remaining.slice(i);
        } else {
            throw { name : "ParseError",
                msg : "Couldnt match parenthesis"
            };
        }
        return [new_partial, new_rest];
    }

}

// What scheme type should a given constnat correspond to?
function tokenType (t) {
    var parsed;
    if ((t.head() == "'" && t.last() == "'") || (t.head() == '"' && t.last() == '"')) 
        parsed = t.slice(1,-1);
    else if (!isNaN(t)) 
        parsed = Number(t);
    else {
        parsed = Object.create(tagged_data);
        parsed.type = "symbol";
        parsed.data = t;
    }
    return parsed;
}

// Parses an S-expression string into a javascript array
function tokenize (expr) {

    if (typeof expr !== "string") { // Only parse strings..
        throw { name:"TypeError",
            msg: "Can only tokenize strings"
        };
    }
    //
    // Remove surrounding parens, if they exist
    if ((expr[0] == "(") && (expr.last() == ")"))
        expr = expr.slice(1,-1);
    else
        return tokenType(expr);

    var partial = [];
    var rest = expr;
    var next;
    while (rest !== "") {
        next = consumeNext(partial, rest);
        partial = next[0];
        rest = next[1];
    }

    return partial;
}

// Tagged data prototype
var tagged_data = {
    type : "symbol",
    data : null,
    typeIs : function (str) {
        return (this.tag == str);
    },
    dataIs : function (str) {
        return (this.data == str);
    }    
};

function isTaggedList (expr, tag) {
    if (is_array(expr)) {
        var head = expr.head();
        return (head.type == 'symbol' && head.data == tag);
    }
    return false;
}

function isSelfEvaluating(expr) {
    return (typeof expr == 'number' || typeof expr == 'string');
}

function isVariable(expr) {
    if (typeof expr == "object" && expr.hasOwnProperty('typeIs'))
        return expr.typeIs('symbol');
    else
        return false;
}

function isQuoted(expr) {
    return isTaggedList(expr, 'quote');
}

function isAssignment(expr) {
    return isTaggedList(expr, 'set!');
}

function isDefinition(expr) {
    return isTaggedList(expr, 'define');
}

function isIf(expr) {
    return isTaggedList(expr, 'if');
}

function isLambda(expr) {
    return isTaggedList(expr, 'lambda');
}

function isBegin(expr) {
    return isTaggedList(expr, 'begin');
}

function isCond(expr) {
    return isTaggedList(expr, 'cond');
}

function isApplication(expr) {
    return is_array(expr);
}

// Eval-Apply Loop

// Evaluates an s-expression thats been converted to an array
function evaluate (raw_expr, env) {

    var expr = tokenize(raw_expr);
    env = env || {'a':5, 'b':6};

    if (isSelfEvaluating(expr)) {
        return expr;
    } else if (isVariable(expr)) {
        return lookupVarValue(expr, env);
    } else if (isQuoted(expr)) {
        return textOfQuotation(expr);
    } else if (isAssignment(expr)) {
        return evalAssignment(expr, env);
    } else if (isDefinition(expr)) {
        return evalDefinition(expr, env);
    } else if (isIf(expr)) {
        return evalIf(expr, env);
    } else if (isLambda(expr)) {
        // TODO
    } else if (isBegin(expr)) {
        // TODO
    } else if (isCond(expr)) {
        return evaluate(condToIf(expr), env);
    } else if (isApplication(expr)) {
        // TODO
    } else {
        throw {
            name : "UnknownExpressionTypeError"
        };
    }
}
 
function apply (proc, args) {
    // body...
}

// Environment functions

function initialEnv () {
    return {};
}

function extendEnv (bindings, base) {
    var new_env = Object.create(base);
    var p;
    for (p in bindings) {
        if (bindings.hasOwnProperty(p))
            new_env[p] = bindings[p];
    }
    return new_env;
}

function lookupVarVal(varname, env) {
    var ans = env[varname];
    if (typeof ans == 'undefined') {
        throw {
            name : "UndefinedError",
            msg : "Var: " + varname + ", is not defined"
        };
    } else 
        return ans;
}

function defineVar (varname, val, env) {
    // For now allows defining a variable twice
    env[varname] = val;
    return true;
}

function setVar (varname, val, env) {
    if (typeof env[varname] == 'undefined') {
        throw {
            name : 'UndefinedError',
            msg : "Var: " + varname + ", is not defined"
        };
    } else {
        env[varname] = val;
        return true;
    }
}

// Breakdown

function condToIf (expr) {
    // TODO
}

function evalIf(expr, env) {
    // TODO
}

function evalDefinition(expr, env) {
    // TODO
}

function evalAssignment(expr, env) {
    // TODO
}

function textOfQuotation(expr) {
    // TODO
}

function lookupVarValue(expr, env) {
    // TODO
}

// Testing
var e = "(define (f a b c) (a (car b b c) (cdr 'horse' 'moose')) (car 1 2 352 'chicken'))";

var a = tokenize(e);

var base = {
    'a' : 5,
    'b' : 6
};
var bindings = {
    'a' : 1,
    'b' : 2,
    'c' : 3
};
var bindings2 = {
    'a' : 100,
    'f' : 5,
    'g' : 6
};

var env1 = extendEnv(bindings, base);
var env2 = extendEnv(bindings2, env1);
