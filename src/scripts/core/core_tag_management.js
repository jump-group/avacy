//REVIEW: may have some changes to be made in order to get purposes correctly @tcf2
import { MANAGED_TAG_IDENTIFIER, MANAGED_TAG_IDENTIFIER_ATTRIBUTE, MANAGED_TAG__ATTRIBUTES } from './core_constants';
import { getSoiCookie } from './core_cookies';
import { arrayContainsArray } from './core_utils';
import { getPurposeIds, getSpecialFeatureIds, getLegintIds } from './core_vendor_lists';
import { getCustomPurposeIds, gdprApplies } from './core_config';

export function manageDomElementActivation() {
  let managedElements = findManagedElements();
  let cookie = getSoiCookie();
  
  for (let i = 0; i < managedElements.length; i++) {
    manageElement(managedElements[i], cookie);
  }
}

function getNecessaryPurposes(element) {
  let purposesString = element.getAttribute(MANAGED_TAG__ATTRIBUTES.PURPOSES_ATTRIBUTE);
  return purposesString ? purposesString.split(/,\s*/) : getPurposeIds().concat(getCustomPurposeIds());
}

function getNecessaryLegint(element) {
  let dataLegint = element.hasAttribute(MANAGED_TAG__ATTRIBUTES.LEGINT_ATTRIBUTE);

  if (dataLegint) {
    let legintString = element.getAttribute(MANAGED_TAG__ATTRIBUTES.LEGINT_ATTRIBUTE);
    return legintString.length ? legintString.split(/,\s*/) : getLegintIds();
  }

  return [];
}

function getNecessarySpecialFeature(element) {
  let dataSpecialFeaturesString = element.hasAttribute(MANAGED_TAG__ATTRIBUTES.SPECIAL_FEATURES_ATTRIBUTE);

  if (dataSpecialFeaturesString) {
    let specialFeaturesString = element.getAttribute(MANAGED_TAG__ATTRIBUTES.SPECIAL_FEATURES_ATTRIBUTE);
    return specialFeaturesString.length ? specialFeaturesString.split(/,\s*/) : getSpecialFeatureIds();
  }

  return [];
}

function findManagedElements() {
  return document.querySelectorAll('[' + MANAGED_TAG_IDENTIFIER_ATTRIBUTE + '=\'' + MANAGED_TAG_IDENTIFIER + '\']');
}

function manageElement(element, cookie) {
  if (element.tagName === 'SCRIPT') {
    manageScriptElement(element, cookie);
  } else {
    manageNonScriptElement(element, cookie);
  }
}

function manageScriptElement(element, cookie) {
  let newElement = document.createElement('script');

  for (let i = 0; i < element.attributes.length; i++) {
    let attribute = element.attributes[i];
    if (attribute.name.match(/^data-/)) {
      newElement.setAttribute(attribute.name, attribute.value);
    }
  }
  if (hasConsent(element, cookie)) {
    if (element.getAttribute('data-type')) {
      newElement.type = element.getAttribute('data-type');
    }
    if (element.getAttribute('data-src')) {
      newElement.src = element.getAttribute('data-src');
    }
  } else {
    // we must set a (dummy) type for script tags without consent - otherwise they will be executed
    newElement.type = MANAGED_TAG_IDENTIFIER;
  }
  newElement.innerText = element.innerText;
  newElement.text = element.text;
  newElement.class = element.class;
  newElement.id = element.id;
  newElement.defer = element.defer;
  newElement.async = element.async;
  newElement.charset = element.charset;

  let parent = element.parentElement;
  parent.insertBefore(newElement, element);
  parent.removeChild(element);
}

function manageNonScriptElement(element, cookie) {
  let managedAttributes = ['href', 'src', 'title', 'display'];
  if (hasConsent(element, cookie)) {
    for (let i = 0; i < managedAttributes.length; i++) {
      manageElementWithConsent(element, managedAttributes[i]);
    }
  } else {
    for (let i = 0; i < managedAttributes.length; i++) {
      manageElementWithoutConsent(element, managedAttributes[i]);
    }
  }
}

function manageElementWithConsent(element, managedAttribute) {
  let managedAttributeValue = element.getAttribute('data-' + managedAttribute);
  if (managedAttribute === 'display') {
    element.style.display = managedAttributeValue ? managedAttributeValue : '';
  } else {
    if (managedAttributeValue) {
      element.setAttribute(managedAttribute, managedAttributeValue);
    }
  }
}

function manageElementWithoutConsent(element, managedAttribute) {
  if (managedAttribute === 'display') {
    element.style.display = 'none';
  } else if (element.hasAttribute(managedAttribute)) {
    element.removeAttribute(managedAttribute);
  }
}

function hasConsent(element, cookie) {
  if(gdprApplies() === false) {
    return true;
  }

  if (cookie.opt_in) {
    let necessaryPurposes = getNecessaryPurposes(element);
    let necessaryLegint = getNecessaryLegint(element);
    let necessarySpecialFeatures = getNecessarySpecialFeature(element);

    let allowedPurposes = [];
    cookie.consentData.purposeConsents.set_.forEach(element => {
      allowedPurposes.push(element)
    });

    let allowedLegint = [];
    cookie.consentData.purposeLegitimateInterests.set_.forEach(element => {
      allowedLegint.push(element)
    });

    let allowedSpecialFeature = [];
    cookie.consentData.specialFeatureOptins.set_.forEach(element => {
      allowedSpecialFeature.push(element)
    });

    allowedPurposes = allowedPurposes ? allowedPurposes.concat(cookie.customPurposes) : cookie.customPurposes;

    let purposesResult = arrayContainsArray(allowedPurposes, necessaryPurposes);
    let legintResult = arrayContainsArray(allowedLegint, necessaryLegint);
    let specialFeaturesResult = arrayContainsArray(allowedSpecialFeature, necessarySpecialFeatures);

    return purposesResult && legintResult && specialFeaturesResult;
  } else {
    return false;
  }
}
