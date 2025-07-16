const jwt = require('jsonwebtoken');
const SpecialRequest = require('../Models/SpecialRequest'); // Ensure this path is correct

const SRequest = async (req, res) => {
  try {
    const { data, requestType, Token } = req.body;
    console.log(data);

    // Check if token is provided
    if (!Token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Decode the token to get the userId
    const tokenPayload = jwt.decode(Token);

    if (!tokenPayload || !tokenPayload.userId) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Validate required fields
    if (!requestType || !data) {
      return res.status(400).json({ message: 'Type and data fields are required' });
    }
    console.log(tokenPayload.userId)
    // Create a new special request entry
    const specialRequest = new SpecialRequest({
      userId: tokenPayload.userId,
     requestType,
      data
    });

    await specialRequest.save();

    return res.status(200).json({ message: 'Request sent successfully' });
  } catch (error) {
    console.error('Error in SRequest:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports ={ SRequest};
