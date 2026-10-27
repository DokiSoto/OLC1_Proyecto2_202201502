import { RuntimeError, printable } from '../environment/Environment.js';

const INITIAL = {
  server: { cpu: 0, memory: 0, disk: 0, os: '', status: 'stopped', packages: [] },
  service: { port: 80, replicas: 1, status: 'undeployed', host: null, dependsOn: [] },
  database: { engine: 'sqlite', version: '1', port: 5432, status: 'stopped', dependsOn: [] },
};
const CONFIGURABLE = {
  server: ['cpu', 'memory', 'disk', 'os'],
  service: ['port', 'replicas', 'dependsOn'],
  database: ['engine', 'version', 'port', 'dependsOn'],
};

export class Infrastructure {
  constructor(context) { this.context = context; this.resources = []; this.connections = []; }
  create(type, name) {
    const resource = { __resource: true, type, name, props: structuredClone(INITIAL[type]) };
    this.resources.push(resource);
    return resource;
  }
  configure(resource, values, loc) {
    for (const name of Object.keys(values)) {
      if (!CONFIGURABLE[resource.type].includes(name))
        throw new RuntimeError(`Propiedad no configurable: ${resource.name}.${name}.`, loc);
    }
    const props = { ...resource.props, ...values };
    // Estas restricciones de service/database no están amarillas en la tabla de p. 10.
    if (resource.type !== 'server' && (!Number.isInteger(props.port) || props.port < 1 || props.port > 65535))
      throw new RuntimeError('El puerto debe estar entre 1 y 65535.', loc, 'INFRA-001', 'Infraestructura');
    if (resource.type === 'service' && props.replicas < 1)
      throw new RuntimeError('La declaración de service requiere replicas >= 1 (p. 10).', loc, 'INFRA-001', 'Infraestructura');
    if (resource.type === 'database' && (!['postgresql', 'mysql', 'sqlite'].includes(props.engine) || props.version === ''))
      throw new RuntimeError('Motor o versión de database inválidos.', loc, 'INFRA-001', 'Infraestructura');
    resource.props = props;
    this.log(`Recurso '${resource.name}' registrado.`);
  }
  log(message, level = 'OK') { this.context.log.push(`[${level}] ${message}`); }
  need(resource, type, loc) {
    if (!resource?.__resource || (type && resource.type !== type))
      throw new RuntimeError(`La acción necesita un recurso${type ? ' ' + type : ''}.`, loc);
    return resource;
  }
  fail(message, loc, code = 'INFRA-002') {
    this.context.errors.push({ type: 'Infraestructura', code, description: message, line: loc.line, column: loc.column });
    this.log(message, 'ERROR');
    return false;
  }
  dependencies(resource, loc) {
    const deps = resource.props.dependsOn ?? [];
    if (!Array.isArray(deps)) return this.fail('dependsOn debe ser un arreglo de referencias.', loc, 'INFRA-004');
    for (const dependency of deps) {
      if (!dependency?.__resource || dependency.props.status !== 'running')
        return this.fail(`No se puede activar '${resource.name}': dependencia '${dependency?.name ?? '?'}' no activa.`, loc, 'INFRA-004');
    }
    return true;
  }
  actions() {
    const native = new Map();
    native.set('print', args => { this.context.console.push(args.map(printable).join(' ')); return null; });
    native.set('length', ([array], loc) => {
      if (!Array.isArray(array)) throw new RuntimeError('length necesita un arreglo.', loc);
      return array.length;
    });
    native.set('status', ([resource], loc) => this.need(resource, null, loc).props.status);
    native.set('start', ([resource], loc) => {
      this.need(resource, null, loc);
      if (!this.dependencies(resource, loc)) return false;
      resource.props.status = 'running'; this.log(`${resource.name} iniciado.`); return true;
    });
    native.set('stop', ([resource], loc) => {
      this.need(resource, null, loc);
      if (resource.props.status === 'stopped') return false;
      resource.props.status = 'stopped'; this.log(`${resource.name} detenido.`); return true;
    });
    native.set('restart', ([resource], loc) => {
      this.need(resource, null, loc);
      if (resource.props.status !== 'running') return this.fail(`No se puede reiniciar '${resource.name}': no está activo.`, loc);
      if (!this.dependencies(resource, loc)) return false;
      this.log(`${resource.name} reiniciado.`); return true;
    });
    native.set('install', ([server, packageName], loc) => {
      this.need(server, 'server', loc);
      if (typeof packageName !== 'string') throw new RuntimeError('El paquete debe tener un nombre string.', loc);
      if (!server.props.packages.includes(packageName)) server.props.packages.push(packageName);
      this.log(`${packageName} instalado en ${server.name}.`); return true;
    });
    native.set('uninstall', ([server, packageName], loc) => {
      this.need(server, 'server', loc);
      const index = server.props.packages.indexOf(packageName);
      if (index < 0) return false;
      server.props.packages.splice(index, 1); this.log(`${packageName} eliminado de ${server.name}.`); return true;
    });
    native.set('deploy', ([server, service], loc) => {
      this.need(server, 'server', loc); this.need(service, 'service', loc);
      // Comprobar todo antes de modificar host y status conserva atomicidad.
      if (!this.dependencies(service, loc)) return false;
      service.props.host = server; service.props.status = 'running';
      this.log(`${service.name} desplegado en ${server.name}.`); return true;
    });
    native.set('scale', ([service, replicas], loc) => {
      this.need(service, 'service', loc);
      if (!Number.isInteger(replicas)) throw new RuntimeError('scale necesita una cantidad entera.', loc);
      const previous = service.props.replicas; service.props.replicas = replicas;
      this.log(`${service.name}: réplicas ${previous} -> ${replicas}.`); return true;
    });
    native.set('connect', ([from, to], loc) => {
      this.need(from, null, loc); this.need(to, null, loc);
      this.connections.push({ from: from.name, to: to.name });
      this.log(`Conexión ${from.name} -> ${to.name}.`); return true;
    });
    native.set('disconnect', ([from, to], loc) => {
      this.need(from, null, loc); this.need(to, null, loc);
      const previous = this.connections.length;
      this.connections = this.connections.filter(c => !(c.from === from.name && c.to === to.name));
      const changed = previous !== this.connections.length;
      if (changed) this.log(`Desconexión ${from.name} -> ${to.name}.`);
      return changed;
    });
    return native;
  }
  report() {
    const simplify = value => value?.__resource ? value.name : Array.isArray(value) ? value.map(simplify) : value;
    const rows = this.resources.map(r => ({ name: r.name, type: r.type,
      ...Object.fromEntries(Object.entries(r.props).map(([key, value]) => [key, simplify(value)])) }));
    return { servers: rows.filter(r => r.type === 'server'), services: rows.filter(r => r.type === 'service'),
      databases: rows.filter(r => r.type === 'database'), connections: this.connections };
  }
}