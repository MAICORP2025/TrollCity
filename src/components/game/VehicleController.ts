import { Vector3, TransformNode } from '@babylonjs/core';

export interface VehicleInputState {
  throttle: number;
  brake: boolean;
  steer: number;
}

export interface VehicleState {
  speed: number;
  targetSpeed: number;
  heading: number;
}

export interface VehicleParams {
  maxSpeed: number;
  acceleration: number;
  braking: number;
  friction: number;
  turnRate: number;
}

export function updateVehicle(
  state: VehicleState,
  input: VehicleInputState,
  dt: number,
  params: VehicleParams,
  root: TransformNode
): { distanceDelta: number } {
  const target = input.throttle > 0 ? params.maxSpeed : 0;
  state.targetSpeed = target;

  const diff = state.targetSpeed - state.speed;
  const accel = diff > 0 ? params.acceleration : params.friction;
  state.speed += diff * Math.min(accel * dt, 1);

  if (input.brake) {
    state.speed -= params.braking * dt;
  }

  if (state.speed < 0) state.speed = 0;

  if (Math.abs(state.speed) > 0.01 && Math.abs(input.steer) > 0.001) {
    const steerDir = state.speed >= 0 ? 1 : -1;
    const turnAmount = input.steer * steerDir * params.turnRate * dt;
    state.heading += turnAmount;
  }

  const dir = new Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
  const distanceDelta = state.speed * dt;
  const delta = dir.scale(distanceDelta);
  root.position = root.position.add(delta);
  root.rotation = new Vector3(0, state.heading, 0);

  return { distanceDelta };
}

