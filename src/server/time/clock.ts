import "server-only";

export interface Clock {
  now(): Date;
}

export const productionClock: Clock = {
  now: () => new Date(),
};
