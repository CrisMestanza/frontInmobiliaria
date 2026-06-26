import { Loader } from "@googlemaps/js-api-loader";

const loader = new Loader({
  apiKey: "AIzaSyBABmst_tbRBz8hpzDhN039KeY1OtVWTQw",
  version: "weekly",
  libraries: ["drawing", "places", "geometry"],
});

export default loader;
