import { describe, it, expect } from 'vitest';
import {
  parseCoordinatesOrLink,
  getMapsNavigationUrl,
  formatAddress,
  parseStoredAddress,
} from '../utils/location';

describe('location utils', () => {
  it('should parse direct coordinate string', () => {
    const res = parseCoordinatesOrLink('37.194521, 40.582134');
    expect(res).toEqual({ lat: 37.194521, lng: 40.582134 });

    const res2 = parseCoordinatesOrLink('37.194521 40.582134');
    expect(res2).toEqual({ lat: 37.194521, lng: 40.582134 });
  });

  it('should parse coordinates from Google Maps URLs', () => {
    const res1 = parseCoordinatesOrLink('https://maps.google.com/?q=37.194521,40.582134');
    expect(res1).toEqual({ lat: 37.194521, lng: 40.582134 });

    const res2 = parseCoordinatesOrLink('https://www.google.com/maps/place/Kiziltepe/@37.194521,40.582134,17z');
    expect(res2).toEqual({ lat: 37.194521, lng: 40.582134 });

    const res3 = parseCoordinatesOrLink('https://maps.google.com/maps?daddr=37.194521,40.582134');
    expect(res3).toEqual({ lat: 37.194521, lng: 40.582134 });

    const res4 = parseCoordinatesOrLink('geo:37.194521,40.582134');
    expect(res4).toEqual({ lat: 37.194521, lng: 40.582134 });
  });

  it('should parse coordinates from embedded location tag', () => {
    const res = parseCoordinatesOrLink('Taşyapı Köyü No:14 (Cami yanı) [📍 37.194521, 40.582134]');
    expect(res).toEqual({ lat: 37.194521, lng: 40.582134 });
  });

  it('should return navigation URL if coordinates present', () => {
    const url = getMapsNavigationUrl('Tepebaşı Mah. [📍 37.194521, 40.582134]');
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=37.194521,40.582134');
  });

  it('should return search URL if only plain text address', () => {
    const url = getMapsNavigationUrl('Kızıltepe Tepebaşı Mah.');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=K%C4%B1z%C4%B1ltepe%20Tepeba%C5%9F%C4%B1%20Mah.');
  });

  it('should format address with components and coordinate tag', () => {
    const addr = formatAddress({
      mahalleKoy: 'Mardin / Kızıltepe / Taşyapı Köyü',
      sokakCadde: 'Köy Girişi',
      binaKapiNo: 'No: 14',
      adresTarifi: 'Cami karşısı, beyaz kapı',
      coords: { lat: 37.194521, lng: 40.582134 },
    });

    expect(addr).toBe(
      'Mardin / Kızıltepe / Taşyapı Köyü - Köy Girişi - No: 14 - (Cami karşısı, beyaz kapı) - [📍 37.194521, 40.582134]'
    );
  });

  it('should parse stored address back into components', () => {
    const stored =
      'Mardin / Kızıltepe / Taşyapı Köyü - Köy Girişi - No: 14 - (Cami karşısı, beyaz kapı) - [📍 37.194521, 40.582134]';
    const parsed = parseStoredAddress(stored);

    expect(parsed.mahalleKoy).toBe('Mardin / Kızıltepe / Taşyapı Köyü');
    expect(parsed.sokakCadde).toBe('Köy Girişi');
    expect(parsed.binaKapiNo).toBe('No: 14');
    expect(parsed.adresTarifi).toBe('Cami karşısı, beyaz kapı');
    expect(parsed.coords).toEqual({ lat: 37.194521, lng: 40.582134 });
  });
});
