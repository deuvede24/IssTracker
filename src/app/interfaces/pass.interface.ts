export interface PassCore {
    readonly id: string;
    readonly time: Date;
    readonly duration: number;
    readonly from: string;
    readonly to: string;
}

export interface PassMap extends PassCore {
    readonly timeToPass?: string;
}

export interface PassHome extends PassCore {
    readonly altitude?: string;
    readonly brightness?: string;
    readonly description?: string;
    readonly timeToPass?: string;
    readonly direction?: string;
    readonly compass?: string;
    readonly azimuth?: { appear: number; disappear: number };
}

export type Pass = PassHome | PassMap;