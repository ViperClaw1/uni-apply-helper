import type { UniversityNavigator } from './university-navigator.js';
import { GenericNavigator } from './generic.navigator.js';
import { SduNavigator } from './sdu.navigator.js';
import { ZzuNavigator } from './zzu.navigator.js';
export declare class NavigationRegistry {
    private readonly zzuNavigator;
    private readonly sduNavigator;
    private readonly genericNavigator;
    constructor(zzuNavigator: ZzuNavigator, sduNavigator: SduNavigator, genericNavigator: GenericNavigator);
    resolve(formUrl: string): UniversityNavigator;
}
