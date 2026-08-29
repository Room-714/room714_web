import { describe, expect, it } from "vitest";
import { shouldRevertReservation } from "./apollo";

// Esta es la decisión que separa "sobrecontar" (seguro) de "infracontar"
// (el fallo que no se puede permitir): dado un error de `enrichPeople`,
// ¿se revierte la reserva del crédito o se deja tal cual? Se prueba aislada
// de Prisma y de `fetch` porque es la única lógica de negocio real en el
// manejo de errores de `acceptCandidate`.
describe("shouldRevertReservation", () => {
  it("revierte cuando hubo respuesta HTTP (Apollo rechazó la petición, no cobró)", () => {
    const err = new Error("Apollo /people/bulk_match respondió 422: id inválido");
    err.gotResponse = true;
    expect(shouldRevertReservation(err)).toBe(true);
  });

  it("NO revierte cuando el fallo fue del fetch (no sabemos si Apollo procesó)", () => {
    const err = new Error("fetch failed");
    // Sin `gotResponse`: es justo la marca que distingue un fallo de red de
    // una respuesta HTTP de error.
    expect(shouldRevertReservation(err)).toBe(false);
  });

  it("NO revierte con gotResponse en falso explícito", () => {
    const err = new Error("timeout");
    err.gotResponse = false;
    expect(shouldRevertReservation(err)).toBe(false);
  });

  it("no revienta con errores sin forma (null, un string, un objeto vacío)", () => {
    expect(shouldRevertReservation(null)).toBe(false);
    expect(shouldRevertReservation(undefined)).toBe(false);
    expect(shouldRevertReservation({})).toBe(false);
  });
});
