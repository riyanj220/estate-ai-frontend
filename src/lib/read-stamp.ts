/**
 * One increasing counter for "which answer is newer". A profile read takes a stamp BEFORE it asks the server; a picture change takes
 * one when the server's answer arrives. A read whose stamp is lower than the last change's was asked before that change finished, so
 * its picture may be older and is never shown over the newer one.
 */
let last = 0;
export const nextStamp = (): number => ++last;
