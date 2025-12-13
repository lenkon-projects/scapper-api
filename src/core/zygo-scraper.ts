/**
 * Zygo Events Scraper
 * Парсер для получения событий с https://zygo.co.il через их API
 */

import axios, { AxiosInstance } from 'axios';
import ZygoTokenService from '../services/zygo-token.service';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[ZygoScraper] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ZygoScraper] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[ZygoScraper] ${msg}`, ...args),
};

interface ZygoLocation {
  address: string;
  lat: number;
  lng: number;
}

interface ZygoPriceRange {
  min: number | null;
  max: number | null;
}

interface ZygoCreator {
  username: string;
  avatar: string;
}

interface ZygoProducer {
  name: string;
  contactDetails: string;
  _id: string;
}

interface ZygoAddressLanguages {
  ar: string;
  en: string;
  he?: string;
}

interface ZygoAdvertisementPixels {
  _id: string;
  facebook?: string;
  tiktok?: string;
}

interface ZygoInitialMessage {
  active: boolean;
  message: string;
  _id: string;
}

export interface ZygoEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  image: string;
  whatsappImage?: string;
  location: ZygoLocation;
  priceRange: ZygoPriceRange;
  visibility: string;
  tags: string[];
  creator: ZygoCreator;
  tickets: string[];
  zygoDesign: number;
  minAge: number;
  feeRate: number;
  fixedFeeRate: number;
  paymentMethod: string;
  allocatedMarketerUsers: string[];
  additionalFields: any[];
  address_languages: ZygoAddressLanguages;
  produced_by: ZygoProducer;
  notNeedInstagram: boolean;
  payments: boolean;
  holiday_packages: any[];
  images: string[];
  paymentGatewayName: string;
  artists: any[];
  eventTags: any[];
  noBirthday: boolean;
  noIdNumber: boolean;
  noGender: boolean;
  sendTicketBySms: boolean;
  no_whatsapp_send: boolean;
  splited_card_allowed: boolean;
  gallery: any[];
  currency: string;
  language: string;
  noFooter: boolean;
  payment_gateway_need_id_number: boolean;
  refund_save_balance: number;
  auto_approve_membership_program: boolean;
  auto_in_event_membership_program: boolean;
  reset_tickets_while_cancel: boolean;
  is_event_giving_membership: boolean;
  identifier_number: number;
  timezone: string;
  createOrder: boolean;
  identifier: string;
  publicChat: string;
  blurhash: string;
  advertisement_pixels?: ZygoAdvertisementPixels;
  initalMessage?: ZygoInitialMessage;
  styles?: {
    backgroundImage?: string;
  };
  custom_agreements?: string;
  donation_settings?: any;
  customeButtonText?: string;
}

export interface ZygoTicket {
  id: string;
  name: string;
  price: number;
  currency: string;
  available: number;
  description?: string;
  event_id: string;
}

export interface ZygoVenue {
  id: string;
  name: string;
  address: string;
  description?: string;
  images: string[];
  location: ZygoLocation;
}

class ZygoScraper {
  private client: AxiosInstance;
  private baseURL = 'https://api.zygo.co.il';
  private apiVersion = 'v1';
  private tokenService: ZygoTokenService;

  constructor() {
    this.tokenService = ZygoTokenService.getInstance();

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'origin': 'https://zygo.co.il',
        'referer': 'https://zygo.co.il/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    // Interceptor для автоматической авторизации
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.tokenService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor для обработки 401 ошибок
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Если 401 и это не повторный запрос
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Проверить статус токена
          const tokenStatus = this.tokenService.getTokenStatus();
          if (tokenStatus.isRefreshTokenInvalid) {
            logger.error(
              '❌ Refresh токен невалиден. ' +
              'Запрос отклонен. ' +
              'Требуется повторная авторизация через /zygo_auth'
            );
            return Promise.reject(
              new Error('Refresh токен невалиден. Требуется авторизация.')
            );
          }

          try {
            // Попытка обновить токен
            await this.tokenService.refreshAccessToken();

            // Получить новый токен и повторить запрос
            const token = await this.tokenService.getAccessToken();
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }

            return this.client.request(originalRequest);
          } catch (refreshError) {
            logger.error('Token refresh failed:', refreshError);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Проверка здоровья API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data === 'OK';
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Получить все события
   */
  async getEvents(): Promise<ZygoEvent[]> {
    try {
      logger.info('Fetching events from Zygo API...');
      const response = await this.client.get(`/${this.apiVersion}/event`);

      if (!Array.isArray(response.data)) {
        throw new Error('Expected array of events');
      }

      logger.info(`Fetched ${response.data.length} events from Zygo`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to fetch events:', error.message);
      throw error;
    }
  }

  /**
   * Получить событие по ID
   */
  async getEventById(eventId: string): Promise<ZygoEvent | null> {
    try {
      const response = await this.client.get(`/${this.apiVersion}/event/${eventId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.warn(`Event ${eventId} not found`);
        return null;
      }
      logger.error(`Failed to fetch event ${eventId}:`, error.message);
      throw error;
    }
  }

  /**
   * Поиск событий
   */
  async searchEvents(query: {
    search?: string;
    category?: string;
    minAge?: number;
    startDate?: string;
    endDate?: string;
    location?: string;
  }): Promise<ZygoEvent[]> {
    try {
      const allEvents = await this.getEvents();

      // Фильтрация на клиенте (если API не поддерживает серверную фильтрацию)
      let filtered = allEvents;

      if (query.search) {
        const searchLower = query.search.toLowerCase();
        filtered = filtered.filter(event =>
          event.title.toLowerCase().includes(searchLower) ||
          event.description.toLowerCase().includes(searchLower)
        );
      }

      if (query.minAge !== undefined) {
        filtered = filtered.filter(event => event.minAge <= query.minAge!);
      }

      if (query.startDate) {
        filtered = filtered.filter(event => new Date(event.startDate) >= new Date(query.startDate!));
      }

      if (query.endDate) {
        filtered = filtered.filter(event => new Date(event.endDate) <= new Date(query.endDate!));
      }

      if (query.location) {
        const locationLower = query.location.toLowerCase();
        filtered = filtered.filter(event =>
          event.location.address.toLowerCase().includes(locationLower)
        );
      }

      return filtered;
    } catch (error: any) {
      logger.error('Failed to search events:', error.message);
      throw error;
    }
  }

  /**
   * Получить предстоящие события
   */
  async getUpcomingEvents(limit?: number): Promise<ZygoEvent[]> {
    try {
      const allEvents = await this.getEvents();
      const now = new Date();

      const upcoming = allEvents
        .filter(event => new Date(event.startDate) > now)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      return limit ? upcoming.slice(0, limit) : upcoming;
    } catch (error: any) {
      logger.error('Failed to fetch upcoming events:', error.message);
      throw error;
    }
  }

  /**
   * Получить события по местоположению
   */
  async getEventsByLocation(location: string): Promise<ZygoEvent[]> {
    return this.searchEvents({ location });
  }

  /**
   * Получить популярные события (по количеству билетов)
   */
  async getPopularEvents(limit: number = 10): Promise<ZygoEvent[]> {
    try {
      const allEvents = await this.getEvents();

      // Сортировка по количеству типов билетов (можно адаптировать)
      const sorted = allEvents.sort((a, b) => b.tickets.length - a.tickets.length);

      return sorted.slice(0, limit);
    } catch (error: any) {
      logger.error('Failed to fetch popular events:', error.message);
      throw error;
    }
  }

  /**
   * Нормализовать событие для сохранения в БД
   */
  normalizeEvent(event: ZygoEvent): any {
    return {
      external_id: event.id,
      source: 'zygo',
      title: event.title,
      description: event.description || '',
      date: event.startDate,
      end_date: event.endDate,
      location: event.location.address,
      latitude: event.location.lat,
      longitude: event.location.lng,
      image_url: event.image,
      price_min: event.priceRange.min,
      price_max: event.priceRange.max,
      currency: event.currency,
      min_age: event.minAge,
      language: event.language,
      organizer_name: event.produced_by.name,
      organizer_contact: event.produced_by.contactDetails,
      url: `https://zygo.co.il/event/${event.identifier}`,
      metadata: {
        visibility: event.visibility,
        tags: event.tags,
        timezone: event.timezone,
        fee_rate: event.feeRate,
        payment_gateway: event.paymentGatewayName,
        tickets_count: event.tickets.length,
        creator_username: event.creator.username,
        identifier: event.identifier,
        identifier_number: event.identifier_number
      }
    };
  }

  /**
   * Получить статистику по событиям
   */
  async getEventsStats(): Promise<{
    total: number;
    upcoming: number;
    past: number;
    by_location: { [key: string]: number };
    by_currency: { [key: string]: number };
    avg_price: number;
  }> {
    const events = await this.getEvents();
    const now = new Date();

    const stats = {
      total: events.length,
      upcoming: events.filter(e => new Date(e.startDate) > now).length,
      past: events.filter(e => new Date(e.startDate) <= now).length,
      by_location: {} as { [key: string]: number },
      by_currency: {} as { [key: string]: number },
      avg_price: 0
    };

    let totalPrice = 0;
    let priceCount = 0;

    events.forEach(event => {
      // Группировка по локации
      const location = event.location.address.split(',').pop()?.trim() || 'Unknown';
      stats.by_location[location] = (stats.by_location[location] || 0) + 1;

      // Группировка по валюте
      stats.by_currency[event.currency] = (stats.by_currency[event.currency] || 0) + 1;

      // Средняя цена
      if (event.priceRange.min !== null) {
        totalPrice += event.priceRange.min;
        priceCount++;
      }
    });

    stats.avg_price = priceCount > 0 ? Math.round(totalPrice / priceCount) : 0;

    return stats;
  }

  /**
   * Получить управляемые события пользователя с аналитикой
   */
  async getManagedEvents(past: boolean = false): Promise<any[]> {
    try {
      logger.info('Fetching managed events from Zygo API...');

      const allEvents: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const timestamp = Date.now();
        const response = await this.client.get(
          `/v2/user/my-manged-events-pages?page=${page}&limit=100&past=${past}&timestamp=${timestamp}`
        );

        if (response.data.ok && response.data.events) {
          allEvents.push(...response.data.events);
          hasMore = page < response.data.pages;
          page++;
        } else {
          hasMore = false;
        }
      }

      logger.info(`Fetched ${allEvents.length} managed events from Zygo`);
      return allEvents;
    } catch (error: any) {
      logger.error('Failed to fetch managed events:', error.message);
      throw error;
    }
  }
}

export default ZygoScraper;
