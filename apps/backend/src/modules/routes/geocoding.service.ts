// =============================================================================
// src/modules/routes/geocoding.service.ts
// =============================================================================
// Geocodificação via Nominatim (OpenStreetMap) + ViaCEP.
// CEP: ViaCEP → Nominatim estruturado (rua) → só cidade/UF → query livre;
// se ainda não houver coords, retorna endereço com needsManualPin.
// =============================================================================

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const VIACEP = "https://viacep.com.br/ws";
const UA = "meuSistemaCompleto/1.0 (localhost dev)";

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
}

interface ViaCepJson {
  erro?: boolean;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

export interface GeoResult {
  lat: number | null;
  lng: number | null;
  address: string;
  city?: string;
  state?: string;
  cep?: string;
  needsManualPin?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expandState(uf: string): string {
  const map: Record<string, string> = {
    MG: "Minas Gerais",
    SP: "São Paulo",
    RJ: "Rio de Janeiro",
    GO: "Goiás",
    DF: "Distrito Federal",
    BA: "Bahia",
    RS: "Rio Grande do Sul",
    PR: "Paraná",
    SC: "Santa Catarina",
    PE: "Pernambuco",
    CE: "Ceará",
    PA: "Pará",
    MT: "Mato Grosso",
    MS: "Mato Grosso do Sul",
    AM: "Amazonas",
    ES: "Espírito Santo",
    PB: "Paraíba",
    RN: "Rio Grande do Norte",
    AL: "Alagoas",
    PI: "Piauí",
    MA: "Maranhão",
    SE: "Sergipe",
    TO: "Tocantins",
    RO: "Rondônia",
    AC: "Acre",
    AP: "Amapá",
    RR: "Roraima",
  };
  return map[uf.toUpperCase()] ?? uf;
}

async function nominatimFetch(params: URLSearchParams): Promise<NominatimItem[]> {
  const res = await fetch(`${NOMINATIM}?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  return (await res.json()) as NominatimItem[];
}

function coordsFromItems(data: NominatimItem[]): { lat: number; lng: number } | null {
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function nominatimStructuredCoords(opts: {
  logradouro?: string;
  localidade: string;
  uf: string;
}): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    format: "json",
    limit: "3",
    countrycodes: "br",
    addressdetails: "1",
    city: opts.localidade,
    state: expandState(opts.uf),
    country: "Brazil",
  });
  if (opts.logradouro?.trim()) params.set("street", opts.logradouro.trim());
  const data = await nominatimFetch(params);
  return coordsFromItems(data);
}

async function nominatimFreeQueryCoords(q: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "3",
    countrycodes: "br",
    addressdetails: "1",
  });
  const data = await nominatimFetch(params);
  return coordsFromItems(data);
}

// ---------------------------------------------------------------------------
// CEP → ViaCEP + fallbacks Nominatim em cascata
// ---------------------------------------------------------------------------
export async function geocodeByCep(cep: string): Promise<GeoResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const vRes = await fetch(`${VIACEP}/${digits}/json/`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!vRes.ok) return null;

    const vData = (await vRes.json()) as ViaCepJson;
    if (vData.erro || !vData.localidade || !vData.uf) return null;

    const { logradouro, bairro, localidade, uf } = vData;
    const address = [logradouro, bairro, `${localidade} - ${uf}`]
      .filter(Boolean)
      .join(", ");

    let coords: { lat: number; lng: number } | null = null;

    if (logradouro?.trim()) {
      await sleep(1100);
      coords = await nominatimStructuredCoords({
        logradouro: logradouro,
        localidade,
        uf,
      });
      console.log(
        "[geocodeByCep] estruturado com rua:",
        Boolean(coords),
        logradouro,
        localidade,
      );
    }

    if (!coords) {
      await sleep(1100);
      coords = await nominatimStructuredCoords({ localidade, uf });
      console.log("[geocodeByCep] só cidade/UF:", Boolean(coords), localidade, uf);
    }

    if (!coords) {
      await sleep(1100);
      const q = `${localidade}, ${expandState(uf)}, Brasil`;
      coords = await nominatimFreeQueryCoords(q);
      console.log("[geocodeByCep] query livre:", q, Boolean(coords));
    }

    if (!coords) {
      console.warn(
        `[geocodeByCep] Nominatim sem coords para CEP ${digits} — ${localidade}/${uf}`,
      );
      return {
        lat: null,
        lng: null,
        address,
        city: localidade,
        state: uf,
        cep: digits,
        needsManualPin: true,
      };
    }

    return {
      lat: coords.lat,
      lng: coords.lng,
      address,
      city: localidade,
      state: uf,
      cep: digits,
      needsManualPin: false,
    };
  } catch (err) {
    console.error("[geocodeByCep]", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Endereço livre + cidade + UF
// ---------------------------------------------------------------------------
export async function geocodeByAddress(
  address: string,
  city?: string,
  state?: string,
): Promise<GeoResult | null> {
  try {
    await sleep(1100);

    const params1 = new URLSearchParams({
      format: "json",
      limit: "3",
      countrycodes: "br",
      addressdetails: "1",
      street: address,
      country: "Brazil",
    });
    if (city?.trim()) params1.set("city", city.trim());
    if (state?.trim()) params1.set("state", expandState(state.trim()));

    let data = await nominatimFetch(params1);

    console.log("[geocodeByAddress] params estruturados:", params1.toString());
    console.log("[geocodeByAddress] results:", data.length);

    if (!data.length) {
      await sleep(1100);
      const q = [address, city, state, "Brasil"].filter(Boolean).join(", ");
      const params2 = new URLSearchParams({
        q,
        format: "json",
        limit: "3",
        countrycodes: "br",
        addressdetails: "1",
      });
      data = await nominatimFetch(params2);
      console.log("[geocodeByAddress] fallback query:", q);
      console.log("[geocodeByAddress] fallback results:", data.length);
    }

    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: data[0].display_name,
      city: city?.trim(),
      state: state?.trim(),
      needsManualPin: false,
    };
  } catch (err) {
    console.error("[geocodeByAddress]", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Texto livre — GET /routes/geocode?q=
// ---------------------------------------------------------------------------
export async function geocodeAddress(query: string): Promise<GeoResult | null> {
  try {
    await sleep(1100);
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "3",
      countrycodes: "br",
      addressdetails: "1",
    });
    const data = await nominatimFetch(params);
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: data[0].display_name,
      needsManualPin: false,
    };
  } catch (err) {
    console.error("[geocodeAddress]", err);
    return null;
  }
}
