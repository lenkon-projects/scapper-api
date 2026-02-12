export interface TickchakUser {
    globalUserId: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    profileImage: string;
    language: string;
    locale: string;
    lastConnect: string;
    emailVerified: number;
    googleVerified: number;
    phoneVerified: number;
    isProducer: number;
}

export interface TickchakLoginResponse {
    tickchak_user_production: string;
    user: TickchakUser;
    exp: number;
    csrfToken: string;
}

export interface TickchakTicketData {
    sold: number;
    amount: number;
    reserved: number;
    free: number;
    closed: number;
}

export interface TickchakEvent {
    eid: number;
    pid: number;
    type: string;
    active: number;
    timeOpen: number;
    timeStart: number;
    timeZone: string;
    name: string;
    description: string;
    title: string;
    location: string;
    locationMap: string;
    tickchakIndex: number;
    timeEnd: number;
    category: number;
    ready: number;
    fbImg: string;
    pTitle: string;
    currencySymbol: string;
    packageRole: any;
    eventRole: string;
    tickets: TickchakTicketData;
}

export interface TickchakEventsResponse {
    events: TickchakEvent[];
    domain: string;
    domainMy: string;
}

export interface TickchakTicketType {
    tid: number;
    title: string;
    description: string;
    amount: number;
    price: string;
    sold: number;
    soldPrice: number;
    typeTicket: string;
}

export interface TickchakTicketResponse {
    ticketsInfo: TickchakTicketType[];
    ticketsIcon: string;
    attendanceReport: number;
}
