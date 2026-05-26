**Bug Fix**
The price filter bug was caused by the min and max values being statically set to 0 and 100 respectively, rather than taking into consideration what the actual min and max prices may be. My fix sets the min and max values by first calling the API for all vehicles available (no date, time, or price filters applied), and extracting the min and max hourly rate from the complete vehicle list. This way when the filters change, the price filter will both display the selected min and max prices via the label text (min price to max price), and the price range filter bar will indicate what subset of the total possible price range the user is asking for, enabling the user to explore all desired options easily.

**Refactor Rationale**
discount.getApplicableDiscount.ts had a parameter called originalTotalCents, and this value for the original total was being calculated and then sent in. This was a calculation that did not need to happen outside of the getApplicableDiscounts function, and made sense to move this functionality within the discounts file overall to create one source of truth for all discount/totals information. 

This same rationale was applied to expanding DiscountResult returned by discount.ts to include fields that are only used for display but still need calculations performed (discountedHourlyRateCents). This prevented duplicated logic. However, it is a slight blurring of the separation between raw discount logic and UI display logic, since now the return object combines values that are purely business logic and values that are purely for UI display purposes. I went with this refactor because although the discounts function now is slightly dual purpose, it prevents duplication and centralizes all calculations that have anything to do with discounts. If this project were scaled, it might be something to revisit to break down discounts.ts into parts that are more focused and granular. 

Some minor fixes:

 - There were hardcoded numbers used to calculate the discounts, which were changed to descriptive constants, increasing readability and maintainability.
 -  There was a double rounding happening for the discountedTotalCents and discountedHourlyRateCents, which may have caused the two to be out of sync. Updated this to derive one from the other, keeping all calculated fields in sync.
 - Simplified discount selection logic to only compare discounted hourly rate rather than computing the totals and comparing that
 - Added getDiscountLabel function to prevent duplicating defining the discount label
 - Added helper functions to reduce code complexity
 - Added unit tests


**UX Suggestion**
It would be beneficial to add a sort by price functionality, so that users are able to quickly find a vehicle that matches their preference, rather than scrolling through the entire list. 

**Ran Out Of Time**
If I had some more time there are a few things I might have changed:

 - There are some inconsistencies with naming, I'd preferably normalize all the naming conventions to improve readability
 - The UI for the discount displays are a bit wonky, I'd want these to be cleaner and fit better on the page
 - The price filter increments by 10, which means if the max and min are not numbers that end in 10 (eg. 32), there is a mismatch between the min/max number and the increment value. I'd want to round the min price down to the nearest 10 and the max price up to the nearest 10, to keep everything consistent
 - The discount deals are basically hardcoded right now, if this project wanted to keep on updating different discount deals, it would be a pain to keep on editing code to change them. A better solution would be to have a configurable list of deals that the code could parse through and apply and compare all the relevant ones
