export const typeDefs = /* GraphQL */ `
  scalar JSON

  type Run { id: ID!, createdAt: String!, inputJson: JSON!, resultJson: JSON, status: String!, notes: String }
  input OptimizeInput {
    anchors: [[Float!]!]!       # m x 3
    attachments: [[Float!]!]!   # m x 3
    cableLengths: [Float!]!     # m
    initialGuess: [Float!]!     # 6
  }
  type OptimizeResult { pose: [Float!]!, error: Float!, iterations: Int!, residuals: [Float!]! }

  type Query { runs: [Run!]!, run(id: ID!): Run }
  type Mutation { optimize(input: OptimizeInput!): OptimizeResult! }
`;
