// src/types/satellite.d.ts - CREAR ESTE ARCHIVO

declare module 'satellite.js' {
  export interface SatRec {
    // Satellite record from TLE
  }
  
  export interface EciVec3<T> {
    x: T;
    y: T;
    z: T;
  }
  
  export interface LookAngles {
    azimuth: number;
    elevation: number;
    rangeSat: number;
  }
  
  export interface PositionAndVelocity {
    position: EciVec3<number> | false;
    velocity: EciVec3<number> | false;
  }
  
  export function twoline2satrec(line1: string, line2: string): SatRec;
  export function propagate(satrec: SatRec, date: Date): PositionAndVelocity;
  export function gstime(date: Date): number;
  export function eciToEcf(positionEci: EciVec3<number>, gmst: number): EciVec3<number>;
  export function ecfToLookAngles(
    observerGd: { latitude: number; longitude: number; height: number }, 
    positionEcf: EciVec3<number>
  ): LookAngles;
  export function degreesToRadians(degrees: number): number;
  export function radiansToDegrees(radians: number): number;
}