import { Loader } from "@googlemaps/js-api-loader";

const loader = new Loader({
  apiKey: "AIzaSyA6BSNJEb6Ku4PuOLd9qXmAa7wOsUg39UA",
  version: "weekly",
  libraries: ["drawing", "places", "geometry"],
});

export default loader;
