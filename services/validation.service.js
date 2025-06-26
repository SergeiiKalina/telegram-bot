class ValidationService {
  isValidLink(link) {
    const regex = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;
    return regex.test(link);
  }

  isValidAltText(alt) {
    return typeof alt === 'string' && alt.length > 0 && alt.length <= 20;
  }

  isValidCoachName(name) {
    return name.length < 2 || name.length > 50;
  }
}

module.exports = { ValidationService };
