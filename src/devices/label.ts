import { DEVICES } from "../design/tokens";

/** Three-digit door number: 4 -> "004". */
export const doorLabelText = (doorNo: number): string =>
  String(doorNo).padStart(DEVICES.devices.door_plate.number.digits, "0");
