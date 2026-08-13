declare namespace google.maps.places {
  interface PlaceResult {
    formatted_address?: string;
  }

  class Autocomplete {
    constructor(
      input: HTMLInputElement,
      options?: { types?: string[]; fields?: string[] },
    );
    addListener(event: "place_changed", handler: () => void): void;
    getPlace(): PlaceResult;
  }
}

interface Window {
  google?: typeof google;
}
