# Dar Spa

The website of Dar Spa, a small medical center in Castro, Chiloé. It publishes
public content, sells vouchers for its offerings, generates exam orders and
supports the staff who redeem vouchers.

Terms are English. The label in parentheses is the Chilean Spanish word the
interface uses for the same concept.

## People and accounts

**Visitor**:
A person reading public content without signing in.

**Account** (cuenta):
A signed-in identity, reached through Google or an email link with the same
verified email.
_Avoid_: User, viewer

**Customer**:
An account in its buyer capacity: the owner of its purchases. Any account,
including an administrator, can be a customer.
_Avoid_: Client, buyer

**Administrator** (administrador):
An account with permission to perform the staff workflows. All administrators
have the same permissions.
_Avoid_: Staff, admin user

**Operator**:
A person who runs deployment and access tooling outside the application, such as
granting administrator access.

**Patient**:
The person who receives care or generates an exam order. There is no patient
record.

**Voucher holder**:
Whoever presents a voucher code. The holder may be the customer or a gift
recipient and needs no account.

## Catalog

**Offering** (servicio):
A named service or package in the catalog, with a description and a CLP price.

**Package** (paquete):
An offering that covers several sessions. It is still one offering and one
voucher per purchased unit.

## Purchasing

**Purchase** (compra):
One checkout of a customer's cart, with the offering terms and prices fixed at
checkout and exactly one Webpay payment. It exists whether or not the payment
succeeds.
_Avoid_: Payment transaction, transaction, order

**Paid purchase**:
A purchase whose payment Webpay authorized. It issues one voucher per purchased
unit.

## Vouchers

**Voucher**:
A transferable right to receive one offering, identified by a code. It is not a
monetary balance.
_Avoid_: GiftCard, gift card, coupon

**Purchased voucher**:
A voucher issued by a paid purchase.

**Manually issued voucher**:
A voucher an administrator issues without an online payment, classified as an
external payment or complimentary and justified by a reason.
_Avoid_: Manual purchase

**External payment** (pago externo):
The category of a manually issued voucher paid outside Webpay.

**Complimentary** (cortesía):
The category of a manually issued voucher given free of charge.
_Avoid_: Courtesy

**Issuance** (emisión):
The creation of a voucher, after a paid purchase or by an administrator.

**Validity period** (vigencia):
The 60 days after issuance during which a voucher can be redeemed. A voucher is
expired once that period has passed.

**Lookup** (consulta):
Finding a voucher by scanning its QR or entering its code. A lookup never
consumes the voucher.

**Redemption** (canje):
An administrator's confirmed consumption of a voucher when treatment begins. A
package is redeemed once, when it starts.
_Avoid_: Use, sale ready

**Redemption reversal** (reversión del canje):
An audited correction of an accidental redemption. The voucher becomes
redeemable again within its original validity period. It is not a refund.

**Delivery** (envío):
A request to email one voucher to one recipient.
_Avoid_: Send, sent, delivered

**Accepted**:
The outcome of an email the provider accepted for sending. It does not prove the
email arrived.

**Unconfirmed**:
The outcome of an email whose acceptance the provider never confirmed.

## Exam orders

**Exam order**:
The template-based PDF generated from a patient's answers to the exam form. It
is not a diagnosis, medical record or clinical recommendation. Emailing it is
not a delivery.
