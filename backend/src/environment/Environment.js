export class RuntimeError extends Error {
    constructor(description, location = {}, code= 'RUN-001', type = 'Ejecucion'){

        super(description);
        this.detail = {type, code, description, line: location.line ?? 1, column: location.column ?? 1};
    }
}

export function printable(value) {
    if(value?.__resource)
        return value.name;

    if(Array.isArray(value))
        return '['+value.map(printable).join(', ')+']';

    if(value?.kind === 'function')
        return '<function>';

    if(value?.kind === 'task')
        return '<task>';

    if(value === null || value === undefined)
        return 'null';

    return String(value);
}

export class Environment {
    constructor(parent = null, name ='global', context = null){
    this.parent = parent;
    this.context = context ?? parent.context;
    this.name = parent ? `${parent.name}/${name}#${++this.context.scopeId}` : name;
this.values = new Map();

}
 child(name){
    return new Environment(this, name);}

    define(name, type, value, category = 'variable'){
        const row ={identifier: name, category, type, scope: this.name, value};
        this.values.set(name, row);
        this.context.symbols.push(row);
        return value;
    }

    resolve(name, location){
        if(this.values.has(name))
            return this.values.get(name);
        if(this.parent)
            return this.parent.resolve(name, location);

        throw new RuntimeError(`Variable ${name} no definida`, location);
    }

    get(name, location){
        return this.resolve(name, location).value;
    }
    set(name, value, location){
        this.resolve(name, location).value = value;
       return value;
    }

}





