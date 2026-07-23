export class GameModulePolicy {
  #builtInModules;

  constructor(builtInModules) {
    this.#builtInModules = new Set(builtInModules);
  }

  isBuiltIn(moduleId) {
    return this.#builtInModules.has(moduleId);
  }

  isEnabled(moduleId, disabledModules = []) {
    return this.isBuiltIn(moduleId) || !disabledModules.includes(moduleId);
  }

  sanitizeDisabled(disabledModules = []) {
    return disabledModules.filter((moduleId) => !this.isBuiltIn(moduleId));
  }
}

export const gameModulePolicy = new GameModulePolicy(['minecraft', 'palworld']);
