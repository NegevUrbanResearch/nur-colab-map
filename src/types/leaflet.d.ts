import "leaflet";

declare module "leaflet" {
  interface Layer {
    featureId?: number;
  }
}
