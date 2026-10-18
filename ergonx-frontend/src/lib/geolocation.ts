/** The device position sent with a clock-in or clock-out, in the shape the API expects. */
export interface DevicePosition {
  lat: number;
  lng: number;
  accuracy_m: number | null;
}

export type PositionResult = { position: DevicePosition; error?: undefined } | { position: null; error: string };

/**
 * Asks the browser for the device's current position once. Never throws: a
 * refusal, a timeout or an unsupported browser comes back as a readable error.
 */
export function getDevicePosition(timeoutMs = 15_000): Promise<PositionResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ position: null, error: "This browser can't share your location." });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (result) => resolve({ position: { lat: result.coords.latitude, lng: result.coords.longitude, accuracy_m: Number.isFinite(result.coords.accuracy) ? result.coords.accuracy : null } }),
      (failure) => resolve({
        position: null,
        error: failure.code === failure.PERMISSION_DENIED
          ? "Location access is blocked. Allow location for ErgonX in your browser settings and try again."
          : failure.code === failure.TIMEOUT
            ? "Your location took too long to find. Try again, ideally near a window or outdoors."
            : "Your location isn't available right now.",
      }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/** A map link for a stored clock position. */
export function mapLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
