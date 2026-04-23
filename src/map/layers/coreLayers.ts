import heritageAxisUrl from "../../assets/layers/future_development/heritage-axis.geojson?url";
import parkingIconUrl from "../../assets/layers/future_development/parking-icon.png?url";
import parkingLotsUrl from "../../assets/layers/future_development/parking-lots.geojson?url";

export function getCoreLayerUrls(): {
  heritageAxis: string;
  parkingLots: string;
  parkingIcon: string;
} {
  return {
    heritageAxis: heritageAxisUrl,
    parkingLots: parkingLotsUrl,
    parkingIcon: parkingIconUrl,
  };
}
