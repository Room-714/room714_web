import { oferta } from "../../_vistas/oferta";
import { OFERTA_IA_DATA } from "@/app/data/ofertas";

const { Page, generateMetadata } = oferta(OFERTA_IA_DATA);

export default Page;
export { generateMetadata };
