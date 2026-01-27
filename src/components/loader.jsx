import { Loader } from "@googlemaps/js-api-loader";

const loader = new Loader({
  apiKey: "AIzaSyA0dsaDHTO3rx48cyq61wbhItaZ_sWcV94",
  version: "weekly",
  libraries: ["drawing", "places", "geometry"],
});

export default loader;
