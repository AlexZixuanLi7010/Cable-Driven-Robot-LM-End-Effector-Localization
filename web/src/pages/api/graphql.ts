import { createYoga, createSchema } from "@graphql-yoga/node";
import { typeDefs } from "../../graphql/typeDefs";
import { resolvers } from "../../graphql/resolvers";

export const config = { api: { bodyParser: false } };

export default createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  graphqlEndpoint: "/api/graphql",
});
